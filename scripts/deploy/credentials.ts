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
  roleArn: string;
  providerArn: string;
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
    OSS_ROLE_ARN: env.OSS_ROLE_ARN,
    OSS_OIDC_PROVIDER_ARN: env.OSS_OIDC_PROVIDER_ARN,
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
    bucket: required.OSS_BUCKET!,
    region: required.OSS_REGION!,
    roleArn: required.OSS_ROLE_ARN!,
    providerArn: required.OSS_OIDC_PROVIDER_ARN!,
    prefix: prefix ? `${prefix}/` : "",
    cdnDomain: env.CDN_DOMAIN?.trim() || undefined,
  };
}

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
  sessionToken: string;
  /** ISO 8601, as STS returns it — logged, never parsed for logic. */
  expiration: string;
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
      RoleArn: config.roleArn,
      OIDCProviderArn: config.providerArn,
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
