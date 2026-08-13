/*
 * From a GitHub Actions run to temporary Aliyun credentials, with no secret
 * stored anywhere and no dependency added.
 *
 * Two hops, and the second is the reason this is short:
 *
 *   1. GitHub mints a signed OIDC token for the run. `@actions/core.getIDToken`
 *      does exactly one `fetch` against two environment variables, so a `fetch`
 *      is what this does.
 *   2. Aliyun STS `AssumeRoleWithOIDC` takes that token and returns an access
 *      key, a secret and a session token. It is the one Aliyun API that is
 *      **anonymous**: the OIDC token IS the authentication, so nothing here has
 *      to sign anything. That single fact is what keeps the upload path free of
 *      an SDK — see `scripts/deploy.ts`, which then only needs `Bun.S3Client`.
 *
 * The credentials expire in an hour and are never written to disk.
 */

/** What the run needs before it touches the network, and where it comes from. */
export interface DeployConfig {
  bucket: string;
  region: string;
  /**
   * The role to assume and the provider that vouches for the token — required
   * by the OIDC path and by nothing else, so they are optional here and
   * demanded where they are used. A local round trip against a bucket has no
   * business inventing two ARNs to satisfy a reader.
   */
  roleArn: string | undefined;
  providerArn: string | undefined;
  /** Optional key prefix, so one bucket can host more than one site. */
  prefix: string;
  /** Optional: the CDN domain to purge. Absent means no purge, not an error. */
  cdnDomain: string | undefined;
}

/**
 * Every missing variable is named at once, before any request. A deploy that
 * dies on its third of seven settings has already spent a minute and half a
 * bucket listing to say something it knew at the start.
 */
export function readConfig(
  env: Record<string, string | undefined>,
): DeployConfig {
  const required = {
    OSS_BUCKET: env.OSS_BUCKET,
    OSS_REGION: env.OSS_REGION,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(
      `deploy: missing ${missing.join(", ")}. Set them in the workflow ` +
        "environment; none of them is a secret except by convention.",
    );
  }

  // A prefix is a folder, so it is normalized once here rather than at every
  // key concatenation: no leading slash, exactly one trailing slash, or empty.
  const prefix = (env.OSS_PREFIX ?? "").replace(/^\/+|\/+$/g, "");

  return {
    // Trimmed, not merely validated trimmed: a trailing space survived into
    // the endpoint and failed DNS resolution with nothing naming the cause.
    bucket: required.OSS_BUCKET!.trim(),
    region: required.OSS_REGION!.trim(),
    roleArn: env.OSS_ROLE_ARN?.trim() || undefined,
    providerArn: env.OSS_OIDC_PROVIDER_ARN?.trim() || undefined,
    prefix: prefix ? `${prefix}/` : "",
    cdnDomain: env.CDN_DOMAIN?.trim() || undefined,
  };
}

/** The audience the Aliyun role’s trust policy checks. */
export const AUDIENCE = "sts.aliyuncs.com";

/** The endpoint OSS wants: the bucket lives in the host, not in the path. */
export function ossEndpoint(bucket: string, region: string): string {
  return `https://${bucket}.oss-${region}.aliyuncs.com`;
}

/**
 * The OIDC token GitHub issues for this run. `audience` is what the Aliyun
 * role’s trust policy checks, so it has to match the provider registered
 * there — `sts.aliyuncs.com` in the documented setup.
 */
export async function githubIdToken(
  audience: string,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const token = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "deploy: no OIDC token available. The job needs " +
        "`permissions: id-token: write`; outside Actions there is nothing to " +
        "mint one.",
    );
  }

  const response = await fetch(
    `${url}&audience=${encodeURIComponent(audience)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(
      `deploy: GitHub refused the OIDC token (HTTP ${response.status}).`,
    );
  }
  const body = await response.json() as { value?: string };
  if (!body.value) {
    throw new Error("deploy: the OIDC response carried no token.");
  }
  return body.value;
}

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  /** Absent for a long-lived key; STS credentials always carry one. */
  sessionToken?: string;
  /** ISO 8601 from STS, or a note for a static key. Logged, never parsed. */
  expiration: string;
}

/** One entry of the Aliyun CLI credential file, as far as this needs it. */
interface CliProfile {
  name?: string;
  mode?: string;
  access_key_id?: string;
  access_key_secret?: string;
  sts_token?: string;
}

/**
 * The credentials the Aliyun CLI already holds, at its own standard path.
 *
 * Reading `~/.aliyun/config.json` rather than asking for a key in a `.env`
 * means the secret stays in the one place it already lives, is never copied,
 * and cannot be pasted into a commit. `ALIBABA_CLOUD_PROFILE` picks a profile;
 * without it, the one the CLI itself considers current.
 *
 * Only the two modes that carry usable credentials are honoured — `AK` and
 * `StsToken`. The others (`RamRoleArn`, `EcsRamRole`, …) are indirections the
 * CLI resolves at call time with its own signing code, and reimplementing that
 * to save a developer one command is not a trade worth making.
 */
export async function cliCredentials(
  profileName?: string,
  home = process.env.HOME ?? "",
): Promise<Credentials | null> {
  const file = Bun.file(`${home}/.aliyun/config.json`);
  if (!(await file.exists())) return null;

  const config = await file.json() as {
    current?: string;
    profiles?: CliProfile[];
  };
  const wanted = profileName ?? config.current;
  const profile = config.profiles?.find((p) => p.name === wanted);
  if (!profile?.access_key_id || !profile.access_key_secret) return null;
  if (profile.mode !== "AK" && profile.mode !== "StsToken") return null;

  return {
    accessKeyId: profile.access_key_id,
    secretAccessKey: profile.access_key_secret,
    ...(profile.sts_token ? { sessionToken: profile.sts_token } : {}),
    expiration: `from the aliyun CLI profile “${wanted}”`,
  };
}

/**
 * Where the credentials come from, which is not a preference but a fact about
 * where the process is running.
 *
 * In Actions, the OIDC hop: nothing is stored, and the identity is the run
 * itself. On a laptop there is no such identity to present — GitHub mints its
 * token for one workflow run and for nothing else, and no local runner can
 * forge one — so a real round trip against a real bucket needs a long-lived
 * key. It comes from the Aliyun CLI’s own file if there is one, and from the
 * environment otherwise. Both are weaker credentials by design, which is why
 * they are the fallback and why the run says so out loud.
 */
export async function resolveCredentials(
  config: DeployConfig,
  env: Record<string, string | undefined> = process.env,
): Promise<Credentials> {
  if (env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    if (!config.roleArn || !config.providerArn) {
      throw new Error(
        "deploy: the OIDC path needs OSS_ROLE_ARN and OSS_OIDC_PROVIDER_ARN. " +
          "They are the only two settings a local round trip does not use.",
      );
    }
    return await assumeRole(config, await githubIdToken(AUDIENCE, env));
  }

  const accessKeyId = env.OSS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.OSS_ACCESS_KEY_SECRET?.trim();
  if (accessKeyId && secretAccessKey) {
    console.warn(
      "deploy: using a long-lived key from the environment — the local path. " +
        "A deploy from Actions mints its credentials through OIDC.",
    );
    return { accessKeyId, secretAccessKey, expiration: "long-lived key (env)" };
  }

  const cli = await cliCredentials(env.ALIBABA_CLOUD_PROFILE);
  if (cli) {
    console.warn(
      `deploy: using the aliyun CLI credentials — the local path. ` +
        "A deploy from Actions mints its credentials through OIDC.",
    );
    return cli;
  }

  throw new Error(
    "deploy: no credentials. Inside Actions the job needs " +
      "`permissions: id-token: write`; locally, either `aliyun configure` " +
      "(mode AK) or OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET in a " +
      "gitignored .env.",
  );
}

/**
 * Trade the OIDC token for an hour of Aliyun credentials.
 *
 * `AssumeRoleWithOIDC` is called anonymously and its parameters go in the query
 * string; the RPC signature the rest of Aliyun’s APIs demand does not apply
 * here, which is the whole reason this file has no crypto in it.
 */
export async function assumeRole(
  config: DeployConfig,
  idToken: string,
  sessionName = "github-actions",
): Promise<Credentials> {
  const url = new URL("https://sts.aliyuncs.com/");
  for (
    const [key, value] of Object.entries({
      Action: "AssumeRoleWithOIDC",
      Format: "JSON",
      Version: "2015-04-01",
      RoleArn: config.roleArn!,
      OIDCProviderArn: config.providerArn!,
      OIDCToken: idToken,
      RoleSessionName: sessionName,
      DurationSeconds: "3600",
    })
  ) url.searchParams.set(key, value);

  const response = await fetch(url, { method: "POST" });
  const body = await response.json() as {
    Credentials?: {
      AccessKeyId: string;
      AccessKeySecret: string;
      SecurityToken: string;
      Expiration: string;
    };
    Code?: string;
    Message?: string;
  };

  if (!response.ok || !body.Credentials) {
    throw new Error(
      `deploy: STS refused AssumeRoleWithOIDC (HTTP ${response.status}` +
        `${body.Code ? `, ${body.Code}` : ""})` +
        `${body.Message ? `: ${body.Message}` : "."}`,
    );
  }

  const { AccessKeyId, AccessKeySecret, SecurityToken, Expiration } =
    body.Credentials;
  return {
    accessKeyId: AccessKeyId,
    secretAccessKey: AccessKeySecret,
    sessionToken: SecurityToken,
    expiration: Expiration,
  };
}
