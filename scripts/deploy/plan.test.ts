/*
 * The planner is where a deploy can go wrong without anyone noticing: a wrong
 * order serves a page before its assets, a wrong cache header pins a stale
 * document for a year, and a digest read the wrong way round re-uploads the
 * whole site every time or — worse — never uploads anything again.
 */

import { expect, test } from "bun:test";
import {
  cacheControl,
  deletesLookLikeAMistake,
  type LocalFile,
  planUpload,
  type RemoteObject,
} from "./plan.ts";

/** A local file whose digest is whatever the test says it is. */
const file = (key: string, md5 = `md5-of-${key}`): LocalFile => ({
  key,
  md5: () => Promise.resolve(md5),
});

/** What OSS returns: quoted, uppercase. */
const object = (key: string, md5 = `md5-of-${key}`): RemoteObject => ({
  key,
  etag: `"${md5.toUpperCase()}"`,
});

const LOCAL = [
  file("index.html"),
  file("fr/index.html"),
  file("assets/index-abc123.js"),
  file("assets/noto-sans-latin-1-def456.woff2"),
  file("feed.json"),
  file("sitemap.xml"),
];

test("a hashed asset already in the bucket is not uploaded again", async () => {
  const plan = await planUpload(LOCAL, [object("assets/index-abc123.js")]);

  expect(plan.uploads.map((u) => u.key)).not.toContain(
    "assets/index-abc123.js",
  );
});

/*
 * The digest is what makes a deploy differential: an article edited alone must
 * move alone, and the 108 pages that did not change must stay put.
 */
test("an unchanged page is not uploaded", async () => {
  const plan = await planUpload(LOCAL, LOCAL.map((f) => object(f.key)));

  expect(plan.uploads).toEqual([]);
  expect(plan.kept).toBe(LOCAL.length);
});

test("a changed page is uploaded, and only it", async () => {
  const remote = LOCAL.map((f) => object(f.key));
  const plan = await planUpload(
    [
      ...LOCAL.slice(0, 1),
      file("fr/index.html", "a-new-digest"),
      ...LOCAL.slice(2),
    ],
    remote,
  );

  expect(plan.uploads.map((u) => u.key)).toEqual(["fr/index.html"]);
});

/*
 * OSS quotes its ETags and upper-cases them; a local digest is bare and lower.
 * Comparing them naively would make every deploy a full one.
 */
test("the ETag is compared without its quotes or its case", async () => {
  const plan = await planUpload(
    [file("index.html", "ABCdef123")],
    [{ key: "index.html", etag: '"abcDEF123"' }],
  );

  expect(plan.uploads).toEqual([]);
});

/*
 * The order is the whole safety property: a page must never reach a reader
 * before the assets it names.
 */
test("assets are uploaded before the pages that reference them", async () => {
  const plan = await planUpload(LOCAL, []);
  const keys = plan.uploads.map((u) => u.key);

  const lastAsset = keys.reduce(
    (last, key, i) => (key.startsWith("assets/") ? i : last),
    -1,
  );
  const firstPage = keys.findIndex((key) => key.endsWith(".html"));

  expect(lastAsset).toBeLessThan(firstPage);
});

test("a remote key with no local file is deleted, and nothing else is", async () => {
  const plan = await planUpload(LOCAL, [
    object("assets/index-old000.js"),
    object("index.html"),
    object("de/index.html"),
  ]);

  expect(plan.deletes).toEqual(["assets/index-old000.js", "de/index.html"]);
});

test("an empty bucket takes the whole site", async () => {
  const plan = await planUpload(LOCAL, []);

  expect(plan.uploads).toHaveLength(LOCAL.length);
  expect(plan.deletes).toEqual([]);
  expect(plan.kept).toBe(0);
});

/*
 * The near-miss this guard exists for: pointed at a bucket holding another
 * site, the plan removes everything in it to make room.
 */
test("removing more than the site holds is refused until it is meant", async () => {
  const strangers = Array.from({ length: 300 }, (_, i) => object(`old/${i}`));

  expect(deletesLookLikeAMistake(await planUpload(LOCAL, strangers))).toBe(
    true,
  );
  expect(deletesLookLikeAMistake(await planUpload(LOCAL, []))).toBe(false);
});

test.each([
  ["assets/index-abc123.js", "public, max-age=31536000, immutable"],
  [
    "assets/noto-sans-latin-1-def456.woff2",
    "public, max-age=31536000, immutable",
  ],
  ["index.html", "public, max-age=0, must-revalidate"],
  ["zh-hant/blog/x.html", "public, max-age=0, must-revalidate"],
  ["feed.json", "public, max-age=300"],
  ["feed.zh-hant.json", "public, max-age=300"],
  ["sitemap.xml", "public, max-age=300"],
  ["sitemap.css", "public, max-age=300"],
  ["robots.txt", "public, max-age=300"],
  ["og-image.png", "public, max-age=86400"],
])("%s is cached as %s", (key, expected) => {
  expect(cacheControl(key)).toBe(expected);
});

/*
 * A hashed asset is immutable BECAUSE its key changes with its content. An
 * unhashed file under assets/ would be pinned for a year under a name that can
 * be rewritten — the one way this policy could lie to a reader.
 */
test("every asset the build emits carries a hash in its name", async () => {
  const names: string[] = [];
  for await (
    const name of new Bun.Glob("*").scan({
      cwd: `${import.meta.dir}/../../dist/assets`,
      onlyFiles: true,
    })
  ) names.push(name);

  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    expect([name, /-[a-z0-9]{6,}\.[a-z0-9]+(\.map)?$/i.test(name)])
      .toEqual([name, true]);
  }
});
