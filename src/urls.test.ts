/*
 * The layout puts English at the root and every other language in a folder of
 * its own. Depth therefore stops being uniform, and every asset path and every
 * link has to be computed. These tests are what stops one `../` too many.
 */

import { expect, test } from "bun:test";
import {
  assertSlug,
  hrefTo,
  pageDepth,
  pagePath,
  rel,
  RESERVED_SLUGS,
} from "./urls.ts";

test("rel(depth) climbs back to the site root", () => {
  expect(rel(0)).toBe("./");
  expect(rel(1)).toBe("../");
  expect(rel(2)).toBe("../../");
});

test.each([
  [{ kind: "home", lang: "en" } as const, "index.html", 0],
  [{ kind: "cv", lang: "en" } as const, "cv.html", 0],
  [{ kind: "blogIndex", lang: "en" } as const, "blog/index.html", 1],
  [
    { kind: "post", lang: "en", slug: "mesurer" } as const,
    "blog/mesurer.html",
    1,
  ],
  [{ kind: "home", lang: "fr" } as const, "fr/index.html", 1],
  [{ kind: "cv", lang: "fr" } as const, "fr/cv.html", 1],
  [{ kind: "blogIndex", lang: "fr" } as const, "fr/blog/index.html", 2],
  [
    { kind: "post", lang: "zh-hant", slug: "mesurer" } as const,
    "zh-hant/blog/mesurer.html",
    2,
  ],
])("pagePath/%o", (ref, path, depth) => {
  expect(pagePath(ref)).toBe(path);
  expect(pageDepth(ref)).toBe(depth);
});

test("a cross-language link climbs and comes back down", () => {
  const from = { kind: "post", lang: "fr", slug: "mesurer" } as const;
  expect(hrefTo(from, { kind: "home", lang: "en" })).toBe("../../index.html");
  expect(hrefTo(from, { kind: "cv", lang: "zh" })).toBe("../../zh/cv.html");
  expect(hrefTo(from, { kind: "post", lang: "en", slug: "mesurer" }))
    .toBe("../../blog/mesurer.html");
});

test("a link from the root stays local", () => {
  const from = { kind: "home", lang: "en" } as const;
  expect(hrefTo(from, { kind: "cv", lang: "en" })).toBe("./cv.html");
  expect(hrefTo(from, { kind: "blogIndex", lang: "fr" }))
    .toBe("./fr/blog/index.html");
});

test.each([...RESERVED_SLUGS])("the reserved slug “%s” is refused", (slug) => {
  expect(() => assertSlug(slug, `content/posts/${slug}/fr.md`)).toThrow(slug);
});

test("the language codes are reserved", () => {
  expect(() => assertSlug("zh-hant", "p")).toThrow();
});

test.each(["Mesurer", "mon article", "a/b", "", "é"])(
  "a slug outside [a-z0-9-] is refused: %s",
  (slug) => {
    expect(() => assertSlug(slug, "p")).toThrow();
  },
);

test("an ordinary slug passes", () => {
  expect(() => assertSlug("mesurer-le-texte", "p")).not.toThrow();
});
