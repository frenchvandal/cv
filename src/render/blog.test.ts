/*
 * The three blog page kinds. The article's rendered HTML is trusted (the
 * pipeline validated it) and must come through verbatim; everything that is
 * data—titles, summaries, dates—must come through escaped.
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

const POSTS: PostMeta[] = [
  post("a", "fr"),
  post("a", "en"),
  post("b", "fr", "2026-09-01"),
];

test("l'accueil montre le hero et les derniers écrits de la langue", () => {
  const html = renderPage({ kind: "home", posts: POSTS }, "fr", "light");

  expect(html).toContain("hero__name");
  expect(html).toContain("Derniers écrits");
  expect(html).toContain("Titre b fr");
  expect(html).not.toContain("Titre a en");
});

test("l'accueil d'une langue sans article le dit au lieu de mentir", () => {
  const html = renderPage({ kind: "home", posts: POSTS }, "es", "light");
  expect(html).toContain("Todavía no hay nada publicado");
});

test("l'index blog liste tous les articles de la langue, du plus récent au plus ancien", () => {
  const html = renderPage({ kind: "blogIndex", posts: POSTS }, "fr", "light");
  expect(html.indexOf("Titre b fr")).toBeLessThan(html.indexOf("Titre a fr"));
});

test("une page d'article porte son corps, sa date et un retour vers l'index", () => {
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

test("la date visible est localisée, jamais la date ISO brute", () => {
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

  expect(fr).toContain("8 août 2026");
  expect(zh).toContain("2026年8月8日");
});

test("le sélecteur mène à la traduction quand elle existe", () => {
  const html = renderPage(
    { kind: "post", post: post("a", "fr"), html: "", posts: POSTS },
    "fr",
    "light",
  );
  expect(html).toContain('href="../../blog/a.html"');
});

test("sinon il mène à l'index de la langue, avec une mention audible", () => {
  const html = renderPage(
    { kind: "post", post: post("b", "fr"), html: "", posts: POSTS },
    "fr",
    "light",
  );

  expect(html).toContain('href="../../blog/index.html"');
  // The note is escaped like every translated string (n&#039;est): assert it
  // through escapeHtml rather than hard-coding the apostrophe's code point.
  expect(html).toContain(escapeHtml(translations.fr.blog.notInLanguage));
});

test("le markup d'un article n'est jamais échappé, celui d'un titre l'est toujours", () => {
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
