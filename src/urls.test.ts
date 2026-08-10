/*
 * La disposition met l’anglais à la racine et chaque autre langue dans son
 * dossier. La profondeur cesse donc d’être uniforme, et tout chemin d’asset ou
 * de lien se calcule. Ces tests sont ce qui empêche un `../` de trop.
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

test("rel(depth) remonte à la racine du site", () => {
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

test("un lien croisé remonte puis redescend", () => {
  const from = { kind: "post", lang: "fr", slug: "mesurer" } as const;
  expect(hrefTo(from, { kind: "home", lang: "en" })).toBe("../../index.html");
  expect(hrefTo(from, { kind: "cv", lang: "zh" })).toBe("../../zh/cv.html");
  expect(hrefTo(from, { kind: "post", lang: "en", slug: "mesurer" }))
    .toBe("../../blog/mesurer.html");
});

test("un lien depuis la racine reste local", () => {
  const from = { kind: "home", lang: "en" } as const;
  expect(hrefTo(from, { kind: "cv", lang: "en" })).toBe("./cv.html");
  expect(hrefTo(from, { kind: "blogIndex", lang: "fr" }))
    .toBe("./fr/blog/index.html");
});

test.each([...RESERVED_SLUGS])("le slug réservé « %s » est refusé", (slug) => {
  expect(() => assertSlug(slug, `content/posts/${slug}/fr.md`)).toThrow(slug);
});

test("les codes de langue sont réservés", () => {
  expect(() => assertSlug("zh-hant", "p")).toThrow();
});

test.each(["Mesurer", "mon article", "a/b", "", "é"])(
  "un slug hors [a-z0-9-] est refusé : %s",
  (slug) => {
    expect(() => assertSlug(slug, "p")).toThrow();
  },
);

test("un slug ordinaire passe", () => {
  expect(() => assertSlug("mesurer-le-texte", "p")).not.toThrow();
});
