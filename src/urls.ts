/*
 * Where each page lives, and how one gets from one to another.
 *
 * English sits at the root—which is what `langUrl` already encoded—and every
 * other language takes a folder of its own. Depth is therefore no longer
 * uniform, so asset paths and page-to-page links alike go through
 * `rel(depth)`. They stay relative, which is how `dist/` drops under any
 * bucket prefix: the invariant this repo has held from the start.
 */

import type { Lang } from "./translations.ts";
import { LANGS } from "./translations.ts";

export type PageRef =
  | { kind: "home"; lang: Lang }
  | { kind: "cv"; lang: Lang }
  | { kind: "blogIndex"; lang: Lang }
  | { kind: "post"; lang: Lang; slug: string };

/**
 * The names a slug may not take: each already denotes a file or a folder of the
 * site. The language codes are among them—an article slugged “fr” would
 * overwrite that language’s folder.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "assets",
  "blog",
  "cv",
  "index",
  "404",
  "robots",
  "sitemap",
  "feed",
  "og-image",
  ...LANGS,
]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(slug: string, path: string): void {
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`${path}: “${slug}” is a name the site reserves`);
  }
  if (!SLUG.test(slug)) {
    throw new Error(
      `${path}: invalid slug “${slug}”—expected [a-z0-9] groups joined by hyphens`,
    );
  }
}

export function rel(depth: number): string {
  return depth === 0 ? "./" : "../".repeat(depth);
}

/** The file’s path inside `dist/`, with no leading slash. */
export function pagePath(ref: PageRef): string {
  const prefix = ref.lang === "en" ? "" : `${ref.lang}/`;
  switch (ref.kind) {
    case "home":
      return `${prefix}index.html`;
    case "cv":
      return `${prefix}cv.html`;
    case "blogIndex":
      return `${prefix}blog/index.html`;
    case "post":
      return `${prefix}blog/${ref.slug}.html`;
  }
}

/** How many folders sit between the page and the site root. */
export function pageDepth(ref: PageRef): number {
  return pagePath(ref).split("/").length - 1;
}

/** A relative link from one page to another, valid under any prefix. */
export function hrefTo(from: PageRef, to: PageRef): string {
  return `${rel(pageDepth(from))}${pagePath(to)}`;
}
