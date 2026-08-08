/*
 * A post's metadata, and the only operations rendering performs on it.
 *
 * This module is the boundary: it is all a post exposes to the client. The
 * Markdown body, the rendered HTML and the disk path live in
 * scripts/content.ts and never cross this line — a blog has no reason to
 * ship its articles in the bundle.
 */

import { type Lang, LANGS } from "./translations.ts";

export interface PostMeta {
  slug: string;
  lang: Lang;
  title: string;
  date: string; // YYYY-MM-DD
  updated?: string;
  summary: string;
  tags: readonly string[];
}

/** How many posts the home page shows before deferring to the index. */
export const HOME_POST_COUNT = 5;

const SUMMARY_MAX = 200;

/** A language's posts, newest first. */
export function byLang(
  posts: readonly PostMeta[],
  lang: Lang,
): PostMeta[] {
  return posts
    .filter((post) => post.lang === lang)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** The languages a post exists in, in the site's canonical order. */
export function langsOf(posts: readonly PostMeta[], slug: string): Lang[] {
  const present = new Set(
    posts.filter((post) => post.slug === slug).map((post) => post.lang),
  );
  return LANGS.filter((lang) => present.has(lang));
}

/**
 * A summary when the frontmatter gives none. Prefer ending on a full
 * sentence; failing that, truncate on a word, never in the middle of one.
 */
export function deriveSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= SUMMARY_MAX) return clean;

  const head = clean.slice(0, SUMMARY_MAX);
  const sentence = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("。"),
    head.lastIndexOf("！"),
    head.lastIndexOf("？"),
    head.lastIndexOf("? "),
  );
  // Require the sentence to clear a third of the budget, or a stray early
  // period (an abbreviation, an initial) would produce a near-empty summary.
  if (sentence > SUMMARY_MAX / 3) return clean.slice(0, sentence + 1).trim();

  // Chinese has no whitespace between words, so this fallback degrades to a
  // hard cut at the budget for CJK text — there is no word boundary to miss.
  const word = head.lastIndexOf(" ");
  return `${(word > 0 ? head.slice(0, word) : head).trim()}…`;
}
