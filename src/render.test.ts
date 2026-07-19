/*
 * render.ts unit tests — the pure SSG core. No DOM needed: renderApp returns
 * markup strings, so escaping, id uniqueness and anchor resolution are asserted
 * directly on the output for all four languages (the exact markup
 * scripts/build.ts pre-renders into dist/).
 */

import { expect, test } from "bun:test";
import { escapeHtml } from "./dom.ts";
import { langUrl, pageTitle, renderApp } from "./render.ts";
import { type Lang, LANGS, translations } from "./translations.ts";

test("escapeHtml escapes every markup-significant character", () => {
  expect(escapeHtml(`<a href="x">'&`)).toBe(
    "&lt;a href=&quot;x&quot;&gt;&#039;&amp;",
  );
  expect(escapeHtml("plain text")).toBe("plain text");
});

test("langUrl points at sibling pages (English is the directory root)", () => {
  expect(langUrl("en")).toBe("./");
  expect(langUrl("fr")).toBe("fr.html");
  expect(langUrl("zh")).toBe("zh.html");
  expect(langUrl("zh-hant")).toBe("zh-hant.html");
});

test("pageTitle combines display name and hero title", () => {
  const t = translations.en;
  expect(pageTitle(t)).toBe(`${t.name.display} — ${t.hero.title}`);
});

function idsOf(html: string): string[] {
  return [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
}

test.each([...LANGS])(
  "renderApp(%s): every id in the page is unique",
  (lang) => {
    const ids = idsOf(renderApp(lang, "dark"));
    expect(new Set(ids).size).toBe(ids.length);
  },
);

test.each([...LANGS])(
  "renderApp(%s): every hash anchor resolves to an existing id",
  (lang) => {
    const html = renderApp(lang, "dark");
    const ids = new Set(idsOf(html));
    const hrefs = [...html.matchAll(/ href="#([^"]+)"/g)].map((m) => m[1]!);
    // Dots, skip-link, brand, hero CTAs, orb-less fallback links…
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(ids.has(href)).toBe(true);
  },
);

test.each([...LANGS])("renderApp(%s): one nav dot per panel", (lang) => {
  const html = renderApp(lang, "dark");
  // `data-panel` marks the scenes; `[data-panel-live]` must not match.
  const panels = html.match(/ data-panel(?=[\s>])/g)?.length ?? 0;
  const dots = html.match(/ data-dot="/g)?.length ?? 0;
  expect(panels).toBeGreaterThan(0);
  expect(dots).toBe(panels);
});

test.each([...LANGS])(
  "renderApp(%s): translated content lands escaped in the markup",
  (lang: Lang) => {
    const html = renderApp(lang, "dark");
    const t = translations[lang];
    expect(html).toContain(escapeHtml(t.name.display));
    expect(html).toContain(escapeHtml(t.hero.title));
    expect(html).toContain(escapeHtml(t.contact.footer));
  },
);
