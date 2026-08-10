/*
 * The parts of the credential hop that can be checked without a bucket: what
 * the run refuses to start without, and the endpoint shape OSS requires.
 * The two network calls are exercised by the first real deploy, which is the
 * only thing that can exercise them honestly.
 */

import { expect, test } from "bun:test";
import { githubIdToken, ossEndpoint, readConfig } from "./credentials.ts";

const FULL = {
  OSS_BUCKET: "philippe-cv",
  OSS_REGION: "cn-chengdu",
  OSS_ROLE_ARN: "acs:ram::1:role/deploy",
  OSS_OIDC_PROVIDER_ARN: "acs:ram::1:oidc-provider/github",
};

test("a complete environment yields the config, prefix normalized away", () => {
  expect(readConfig(FULL)).toEqual({
    bucket: "philippe-cv",
    region: "cn-chengdu",
    roleArn: "acs:ram::1:role/deploy",
    providerArn: "acs:ram::1:oidc-provider/github",
    prefix: "",
    cdnDomain: undefined,
  });
});

/*
 * One error naming every missing variable, not the first one: a deploy that
 * fails four times in a row over four settings wastes four runs.
 */
test("every missing variable is named at once", () => {
  expect(() => readConfig({ OSS_BUCKET: "b" })).toThrow(
    /OSS_REGION, OSS_ROLE_ARN, OSS_OIDC_PROVIDER_ARN/,
  );
});

test("a blank value counts as missing", () => {
  expect(() => readConfig({ ...FULL, OSS_REGION: "   " }))
    .toThrow(/OSS_REGION/);
});

test.each([
  ["site", "site/"],
  ["/site", "site/"],
  ["site/", "site/"],
  ["/site/blog/", "site/blog/"],
  ["", ""],
])("the prefix %p normalizes to %p", (given, expected) => {
  expect(readConfig({ ...FULL, OSS_PREFIX: given }).prefix).toBe(expected);
});

test("a CDN domain is optional, and blank means absent", () => {
  expect(readConfig({ ...FULL, CDN_DOMAIN: "cv.example.com" }).cdnDomain)
    .toBe("cv.example.com");
  expect(readConfig({ ...FULL, CDN_DOMAIN: "  " }).cdnDomain).toBeUndefined();
});

/*
 * OSS puts the bucket in the host. The path-style form
 * (`oss-cn-x.aliyuncs.com/bucket/key`) is what a reader of the S3 docs writes
 * first, and OSS answers it with a signature error that names nothing.
 */
test("the endpoint carries the bucket in the host", () => {
  expect(ossEndpoint("philippe-cv", "cn-chengdu"))
    .toBe("https://philippe-cv.oss-cn-chengdu.aliyuncs.com");
});

test("outside Actions there is no token to mint, and it says so", async () => {
  await expect(githubIdToken("sts.aliyuncs.com", {})).rejects.toThrow(
    /id-token: write/,
  );
});
