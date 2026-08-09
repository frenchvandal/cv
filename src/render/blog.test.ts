/*
 * The three blog page kinds: home, index, article. `post.html` on an article
 * page is already-validated markup from the Markdown pipeline and must land
 * verbatim; everything else that is data—titles, summaries, dates—must land
 * escaped. See src/render/blog.ts for the rest of the contract.
 */

import { expect, test } from "bun:test";
import { escapeHtml } from "../dom.ts";
import type { PostMeta } from "../post.ts";
import { renderPage } from "../render.ts";
import { translations } from "../translations.ts";

const post = (
  slug: string,
  lang: PostMeta["lang"],
  date = "2026-08-08",
): PostMeta => ({
  slug,
  lang,
  title: `Titre ${slug} ${lang}`,
  date,
  summary: `Résumé ${slug}`,
  tags: ["bun"],
});

// "a" exists in fr and en (a translation to fall back to); "b" exists only
// in fr, and is more recent than "a fr"—the pair a post list has to sort.
const POSTS: PostMeta[] = [
  post("a", "fr"),
  post("a", "en"),
  post("b", "fr", "2026-09-01"),
];

test("home shows the hero and the language's latest writing", () => {
  const html = renderPage({ kind: "home", posts: POSTS }, "fr", "light");

  expect(html).toContain("hero__name");
  expect(html).toContain("Derniers écrits");
  expect(html).toContain("Titre b fr");
  expect(html).not.toContain("Titre a en");
});

test("home for a language with no posts says so instead of showing nothing", () => {
  const html = renderPage({ kind: "home", posts: POSTS }, "es", "light");
  expect(html).toContain(escapeHtml(translations.es.blog.empty));
});

test("the blog index lists every post of the language, newest first", () => {
  const html = renderPage({ kind: "blogIndex", posts: POSTS }, "fr", "light");
  expect(html).toContain('role="list"');
  expect(html.indexOf("Titre b fr")).toBeLessThan(html.indexOf("Titre a fr"));
});

test("an article page carries its body, its date and a way back", () => {
  const html = renderPage(
    {
      kind: "post",
      post: post("a", "fr"),
      html: "<p>Corps.</p>",
      posts: POSTS,
    },
    "fr",
    "light",
  );

  expect(html).toContain("<p>Corps.</p>");
  expect(html).toContain('<time datetime="2026-08-08"');
  expect(html).toContain("Retour aux écrits");
});

test("the visible date is localized by Intl, never the raw ISO date", () => {
  const fr = renderPage(
    { kind: "post", post: post("a", "fr"), html: "", posts: POSTS },
    "fr",
    "light",
  );
  const zh = renderPage(
    { kind: "post", post: post("a", "zh"), html: "", posts: POSTS },
    "zh",
    "light",
  );

  // Both are the same 2026-08-08 ISO date—UTC and locale-formatted, or the
  // build machine's local timezone could push it a day off in either script.
  expect(fr).toContain("8 août 2026");
  expect(zh).toContain("2026年8月8日");
});

test("the language switcher leads to the translation when one exists", () => {
  const html = renderPage(
    { kind: "post", post: post("a", "fr"), html: "", posts: POSTS },
    "fr",
    "light",
  );
  expect(html).toContain('href="../../blog/a.html"');
});

test("otherwise it leads to that language's index, with an audible note", () => {
  const html = renderPage(
    { kind: "post", post: post("b", "fr"), html: "", posts: POSTS },
    "fr",
    "light",
  );

  expect(html).toContain('href="../../blog/index.html"');
  // The note must be readable text (.sr-only), not an aria-label: an
  // attribute carries no language, so a French reader's screen reader would
  // read this Chinese-page fallback aloud in its own voice.
  expect(html).toContain(escapeHtml(translations.fr.blog.notInLanguage));
  expect(html).not.toContain(
    `aria-label="${escapeHtml(translations.fr.blog.notInLanguage)}"`,
  );
});

test("an article's body is never escaped, its title always is", () => {
  const html = renderPage(
    {
      kind: "post",
      post: { ...post("a", "fr"), title: "5 < 6 & « x »" },
      html: "<p><em>vrai</em> markup</p>",
      posts: POSTS,
    },
    "fr",
    "light",
  );

  expect(html).toContain("<em>vrai</em>");
  expect(html).toContain("5 &lt; 6 &amp;");
});
