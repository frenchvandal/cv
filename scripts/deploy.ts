/*
 * Put `dist/` on Aliyun OSS (`bun run deploy`, or `--dry-run` to see the plan).
 *
 * No dependency, and the reason it can be that way is a chain of three
 * measured facts:
 *
 *   1. `AssumeRoleWithOIDC` is anonymous, so trading a GitHub OIDC token for
 *      Aliyun credentials needs no signature at all
 *      ([scripts/deploy/credentials.ts](deploy/credentials.ts)).
 *   2. OSS speaks SigV4, and `Bun.S3Client` signs it — with the bucket in the
 *      host (`virtualHostedStyle`), which is the form OSS accepts.
 *   3. A presigned PUT signs `host` and nothing else. Measured against Bun
 *      1.3.14: `X-Amz-SignedHeaders` comes back as exactly `host`. So
 *      `Cache-Control` and `Content-Type` ride along as ordinary headers,
 *      which is what makes the cache policy expressible without an SDK.
 *
 * Fact 3 also rules out `presign({ type })`: that option becomes a
 * `response-content-type` query parameter, which overrides the type on a GET
 * and does not store one. The type has to be a header on the PUT.
 *
 * All three were confirmed against a real bucket on 2026-08-10
 * (`normcore-dev`, eu-central-1): PUT 200, GET 200, and both `Content-Type`
 * and `Cache-Control` came back exactly as sent. `--smoke` is that check, kept
 * so the next bucket can be asked the same question in thirty bytes.
 *
 * The sync is differential in both directions. OSS returns an ETag that is the
 * MD5 of the object — measured on the same day, for a 13 KB page and a 209 KB
 * font — so an unchanged file is not re-uploaded, and a second deploy of an
 * unchanged site writes nothing at all. What the build no longer emits is
 * removed, and `--prune` guards the case where that removal is really a wrong
 * bucket (see `deletesLookLikeAMistake`).
 */

import { S3Client } from "bun";
import {
  type DeployConfig,
  ossEndpoint,
  readConfig,
  resolveCredentials,
} from "./deploy/credentials.ts";
import {
  cacheControl,
  deletesLookLikeAMistake,
  type LocalFile,
  type Plan,
  planUpload,
  type RemoteObject,
} from "./deploy/plan.ts";

const OUT = "dist";

/** Long enough for a slow upload, short enough to be worthless if it leaks. */
const PRESIGN_TTL_SECONDS = 600;

/** How many objects are in flight at once—OSS is fine with it, CI is not. */
const CONCURRENCY = 16;

/**
 * Every file in `dist/`, with its digest available but not yet computed: the
 * planner asks only for the ones whose key alone cannot settle the question,
 * so a deploy hashes the pages and the feeds and never the megabyte of fonts.
 */
async function localFiles(): Promise<LocalFile[]> {
  const files: LocalFile[] = [];
  for await (
    const key of new Bun.Glob("**/*").scan({ cwd: OUT, onlyFiles: true })
  ) {
    files.push({
      key,
      md5: async () =>
        new Bun.CryptoHasher("md5")
          .update(await Bun.file(`${OUT}/${key}`).arrayBuffer())
          .digest("hex"),
    });
  }
  return files.sort((a, b) => (a.key < b.key ? -1 : 1));
}

/**
 * Every object already in the bucket, under the deployment prefix, with the
 * prefix stripped so both sides of the plan speak the same language. The ETag
 * comes along: it is the MD5, which is what makes the sync differential.
 *
 * `list` pages at 1000 keys; the site is a tenth of that today and the loop
 * costs nothing, but a bucket that has accumulated old builds would silently
 * lose its tail without it — and those are exactly the keys to delete.
 */
async function remoteObjects(
  client: S3Client,
  prefix: string,
): Promise<RemoteObject[]> {
  const objects: RemoteObject[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.list({
      ...(prefix ? { prefix } : {}),
      ...(continuationToken ? { continuationToken } : {}),
      maxKeys: 1000,
    });
    for (const object of page.contents ?? []) {
      objects.push({
        key: object.key.slice(prefix.length),
        etag: object.eTag ?? "",
      });
    }
    continuationToken = page.isTruncated
      ? page.nextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

/**
 * One object, uploaded through a presigned PUT.
 *
 * The body is a `Bun.file`, so it streams rather than loading a 200 KB font
 * into memory to copy it straight back out.
 */
async function put(
  client: S3Client,
  config: DeployConfig,
  key: string,
  cacheControl: string,
): Promise<void> {
  const file = Bun.file(`${OUT}/${key}`);
  const url = client.file(`${config.prefix}${key}`).presign({
    method: "PUT",
    expiresIn: PRESIGN_TTL_SECONDS,
  });

  const response = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
      "Cache-Control": cacheControl,
    },
  });

  if (!response.ok) {
    throw new Error(
      `deploy: PUT ${key} failed (HTTP ${response.status} ${response.statusText}).`,
    );
  }
}

/** Run `work` over `items`, `CONCURRENCY` at a time, failing on the first error. */
async function inBatches<T>(
  items: readonly T[],
  work: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(work));
  }
}

/**
 * One object, all the way there and back — the round trip no unit test can do.
 *
 * This is the check the design calls for before anything else, and it answers
 * the only real question: does OSS accept what `Bun.S3Client` signs? Four
 * things have to hold, and each has its own way of failing:
 *
 *   - the PUT is accepted (SigV4 as Bun writes it, virtual-hosted style);
 *   - the bytes come back;
 *   - `Content-Type` and `Cache-Control` come back with them. They were sent
 *     UNSIGNED, so this is where "signed headers: host" stops being a
 *     measurement about Bun and becomes a fact about the bucket. If OSS
 *     dropped them, the whole cache policy would need the SDK;
 *   - the DELETE is accepted, so a deploy can remove what a build no longer
 *     emits.
 *
 * It writes one 30-byte object under `.smoke-test` and removes it.
 */
async function smokeTest(
  client: S3Client,
  config: DeployConfig,
): Promise<void> {
  const key = `${config.prefix}.smoke-test`;
  const body = `deploy smoke test ${new Date().toISOString()}`;
  const headers = {
    "Content-Type": "text/plain;charset=utf-8",
    "Cache-Control": cacheControl("robots.txt"),
  };

  const putUrl = client.file(key).presign({
    method: "PUT",
    expiresIn: PRESIGN_TTL_SECONDS,
  });
  const put = await fetch(putUrl, { method: "PUT", body, headers });
  console.log(`  PUT    ${put.status} ${put.statusText}`);
  if (!put.ok) {
    throw new Error(
      `deploy: OSS refused the presigned PUT (HTTP ${put.status}). ` +
        `Body: ${(await put.text()).slice(0, 400)}`,
    );
  }

  const get = await fetch(
    client.file(key).presign({ method: "GET", expiresIn: PRESIGN_TTL_SECONDS }),
  );
  const round = await get.text();
  console.log(`  GET    ${get.status} ${get.statusText}`);
  console.log(`  type   ${get.headers.get("content-type")}`);
  console.log(`  cache  ${get.headers.get("cache-control")}`);

  if (round !== body) {
    throw new Error("deploy: the object came back with different bytes.");
  }
  for (const [name, sent] of Object.entries(headers)) {
    const back = get.headers.get(name);
    if (back !== sent) {
      throw new Error(
        `deploy: OSS did not keep ${name} — sent ${JSON.stringify(sent)}, ` +
          `got ${JSON.stringify(back)}. The cache policy cannot be set ` +
          "through an unsigned header on this bucket.",
      );
    }
  }

  await client.delete(key);
  console.log("  DELETE ok");
  console.log("\n✓ OSS accepts the signature, and keeps the unsigned headers.");
}

function describe(plan: Plan): void {
  console.log(
    `${plan.uploads.length} to upload, ${plan.kept} already up to date, ` +
      `${plan.deletes.length} to remove`,
  );
  for (const { key, cacheControl } of plan.uploads) {
    console.log(`  + ${key.padEnd(52)} ${cacheControl}`);
  }
  for (const key of plan.deletes) console.log(`  - ${key}`);
}

if (import.meta.main) {
  const dryRun = Bun.argv.includes("--dry-run");
  const smoke = Bun.argv.includes("--smoke");
  const prune = Bun.argv.includes("--prune");
  const config = readConfig(process.env);

  if (!smoke && !(await Bun.file(`${OUT}/index.html`).exists())) {
    throw new Error(
      `deploy: no ${OUT}/index.html — run \`bun run build\` first.`,
    );
  }

  /*
   * A dry run must not need credentials: the point is to read the plan from a
   * laptop. It therefore compares against an empty bucket, which prints the
   * whole site as new — honest about what it does and does not know.
   */
  let client: S3Client | undefined;
  if (!dryRun) {
    const credentials = await resolveCredentials(config);
    console.log(`Credentials: ${credentials.expiration}`);
    client = new S3Client({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      ...(credentials.sessionToken
        ? { sessionToken: credentials.sessionToken }
        : {}),
      bucket: config.bucket,
      region: config.region,
      endpoint: ossEndpoint(config.bucket, config.region),
      virtualHostedStyle: true,
    });
  }

  if (smoke) {
    if (!client) throw new Error("deploy: --smoke needs credentials.");
    console.log(`Round trip against ${config.bucket}:`);
    await smokeTest(client, config);
  } else {
    const plan = await planUpload(
      await localFiles(),
      client ? await remoteObjects(client, config.prefix) : [],
    );
    describe(plan);

    if (!dryRun && deletesLookLikeAMistake(plan) && !prune) {
      throw new Error(
        `deploy: the plan removes ${plan.deletes.length} object(s) to upload ` +
          `${plan.uploads.length} — more than the whole site. That usually ` +
          "means the wrong bucket, or the right one at the wrong OSS_PREFIX. " +
          "Read the list above; pass --prune if you meant it.",
      );
    }

    if (dryRun || !client) {
      console.log("\nDry run: nothing was written.");
    } else {
      // Assets first, then the pages that name them — `planUpload` has already
      // put them in that order, so this loop must not reorder anything.
      const assets = plan.uploads.filter((u) => u.key.startsWith("assets/"));
      const rest = plan.uploads.filter((u) => !u.key.startsWith("assets/"));
      for (const group of [assets, rest]) {
        await inBatches(
          group,
          ({ key, cacheControl }) => put(client, config, key, cacheControl),
        );
      }

      // Deletions last: a stale page goes only once its replacement is live.
      await inBatches(plan.deletes, async (key) => {
        await client.delete(`${config.prefix}${key}`);
      });

      console.log(
        `\n✓ ${plan.uploads.length} object(s) written to ${config.bucket}`,
      );
      if (config.cdnDomain) {
        console.log(
          `  CDN purge of ${config.cdnDomain} is not implemented yet — the ` +
            "hashed assets never need it, and the HTML is already " +
            "must-revalidate.",
        );
      }
    }
  }
}
