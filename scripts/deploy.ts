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
 * What is NOT verified here is the round trip: no bucket answers in a unit
 * test. `--dry-run` prints the plan, and the first real deploy is what proves
 * OSS accepts these signatures. If it does not, the fallback is the official
 * Aliyun SDK for the upload alone; nothing else in this file would move.
 */

import { S3Client } from "bun";
import {
  assumeRole,
  type Credentials,
  type DeployConfig,
  githubIdToken,
  ossEndpoint,
  readConfig,
} from "./deploy/credentials.ts";
import { type Plan, planUpload } from "./deploy/plan.ts";

const OUT = "dist";

/** The audience the Aliyun role’s trust policy checks. */
const AUDIENCE = "sts.aliyuncs.com";

/** Long enough for a slow upload, short enough to be worthless if it leaks. */
const PRESIGN_TTL_SECONDS = 600;

/** How many objects are in flight at once—OSS is fine with it, CI is not. */
const CONCURRENCY = 16;

async function localKeys(): Promise<string[]> {
  const keys: string[] = [];
  for await (
    const file of new Bun.Glob("**/*").scan({ cwd: OUT, onlyFiles: true })
  ) keys.push(file);
  return keys.sort();
}

/**
 * Every key already in the bucket, under the deployment prefix, with the
 * prefix stripped so both sides of the plan speak the same language.
 *
 * `list` pages at 1000 keys; the site is a tenth of that today and the loop
 * costs nothing, but a bucket that has accumulated old builds would silently
 * lose its tail without it — and those are exactly the keys to delete.
 */
async function remoteKeys(client: S3Client, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.list({
      ...(prefix ? { prefix } : {}),
      ...(continuationToken ? { continuationToken } : {}),
      maxKeys: 1000,
    });
    for (const object of page.contents ?? []) {
      keys.push(object.key.slice(prefix.length));
    }
    continuationToken = page.isTruncated
      ? page.nextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
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

function describe(plan: Plan): void {
  console.log(
    `${plan.uploads.length} to upload, ${plan.kept} hashed asset(s) already ` +
      `there, ${plan.deletes.length} to remove`,
  );
  for (const { key, cacheControl } of plan.uploads) {
    console.log(`  + ${key.padEnd(52)} ${cacheControl}`);
  }
  for (const key of plan.deletes) console.log(`  - ${key}`);
}

if (import.meta.main) {
  const dryRun = Bun.argv.includes("--dry-run");
  const config = readConfig(process.env);

  if (!(await Bun.file(`${OUT}/index.html`).exists())) {
    throw new Error(
      `deploy: no ${OUT}/index.html — run \`bun run build\` first.`,
    );
  }

  /*
   * A dry run must not need credentials: the point is to read the plan from a
   * laptop. It therefore compares against an empty bucket, which prints the
   * whole site as new — honest about what it does and does not know.
   */
  let credentials: Credentials | undefined;
  let client: S3Client | undefined;
  if (!dryRun) {
    credentials = await assumeRole(config, await githubIdToken(AUDIENCE));
    console.log(`Credentials until ${credentials.expiration}`);
    client = new S3Client({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      bucket: config.bucket,
      region: config.region,
      endpoint: ossEndpoint(config.bucket, config.region),
      virtualHostedStyle: true,
    });
  }

  const plan = planUpload(
    await localKeys(),
    client ? await remoteKeys(client, config.prefix) : [],
  );
  describe(plan);

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
