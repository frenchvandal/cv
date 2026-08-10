/*
 * A post’s metadata, and the only operations rendering performs on it.
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

/**
 * A language’s posts, newest first.
 *
 * Generic over the post shape so a caller holding richer records—the build
 * holds `Post`, which carries the rendered body—gets them back unchanged
 * instead of narrowed to metadata and then searched for again with a
 * non-null assertion.
 */
export function byLang<T extends PostMeta>(
  posts: readonly T[],
  lang: Lang,
): T[] {
  return posts
    .filter((post) => post.lang === lang)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      // Array.prototype.sort is stable, but that only preserves whatever
      // order the caller passed in — and nothing guarantees the eventual
      // disk-discovery module hands posts to this function in a reproducible
      // order across machines or builds. The slug is unique per language and
      // intrinsic to the post, so breaking same-date ties on it keeps the
      // index identical regardless of caller, which keeps deploys diff-free.
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
}

/** The languages a post exists in, in the site’s canonical order. */
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

  /*
   * Count and cut by grapheme cluster — what a reader calls a character.
   *
   * Cutting by UTF-16 code unit can land inside a surrogate pair and leave
   * half a character behind, which a browser draws as U+FFFD. Cutting by code
   * point fixes that but still splits a cluster built from several of them:
   * measured, `🇫🇷` truncated at a code-point boundary keeps 🇫 and drops 🇷,
   * so the flag renders as a lone letter F.
   *
   * `Intl.Segmenter` is the platform’s own answer and needs no dependency, so
   * there is nothing to hand-roll here. No locale is passed: cluster
   * boundaries are the same in every locale this site publishes, and naming
   * one would suggest a dependence that does not exist.
   */
  const graphemes = [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" })
      .segment(clean),
  ].map((entry) => entry.segment);
  if (graphemes.length <= SUMMARY_MAX) return clean;

  const head = graphemes.slice(0, SUMMARY_MAX).join("");
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
