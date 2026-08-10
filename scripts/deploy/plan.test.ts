/*
 * The planner is where a deploy can go wrong without anyone noticing: a wrong
 * order serves a page before its assets, a wrong cache header pins a stale
 * document for a year. Both are cheap to assert and expensive to discover.
 */

import { expect, test } from "bun:test";
import { cacheControl, planUpload } from "./plan.ts";

const LOCAL = [
  "index.html",
  "fr/index.html",
  "assets/index-abc123.js",
  "assets/noto-sans-latin-1-def456.woff2",
  "feed.json",
  "sitemap.xml",
];

test("a hashed asset already in the bucket is not uploaded again", () => {
  const plan = planUpload(LOCAL, ["assets/index-abc123.js"]);

  expect(plan.uploads.map((u) => u.key)).not.toContain(
    "assets/index-abc123.js",
  );
  expect(plan.kept).toBe(1);
});

test("everything that is not a hashed asset goes up every time", () => {
  const plan = planUpload(LOCAL, LOCAL);

  expect(plan.uploads.map((u) => u.key)).toEqual([
    "index.html",
    "fr/index.html",
    "feed.json",
    "sitemap.xml",
  ]);
});

/*
 * The order is the whole safety property: a page must never reach a reader
 * before the assets it names.
 */
test("assets are uploaded before the pages that reference them", () => {
  const plan = planUpload(LOCAL, []);
  const keys = plan.uploads.map((u) => u.key);

  const lastAsset = keys.reduce(
    (last, key, i) => (key.startsWith("assets/") ? i : last),
    -1,
  );
  const firstPage = keys.findIndex((key) => key.endsWith(".html"));

  expect(lastAsset).toBeLessThan(firstPage);
});

test("a remote key with no local file is deleted, and nothing else is", () => {
  const plan = planUpload(LOCAL, [
    "assets/index-old000.js",
    "index.html",
    "de/index.html",
  ]);

  expect(plan.deletes).toEqual(["assets/index-old000.js", "de/index.html"]);
});

test("an empty bucket takes the whole site", () => {
  const plan = planUpload(LOCAL, []);

  expect(plan.uploads).toHaveLength(LOCAL.length);
  expect(plan.deletes).toEqual([]);
  expect(plan.kept).toBe(0);
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
    const file of new Bun.Glob("*").scan({
      cwd: `${import.meta.dir}/../../dist/assets`,
      onlyFiles: true,
    })
  ) names.push(file);

  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    expect([name, /-[a-z0-9]{6,}\.[a-z0-9]+(\.map)?$/i.test(name)])
      .toEqual([name, true]);
  }
});
