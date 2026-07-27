/*
 * render.ts unit tests — the pure SSG core. No DOM needed: renderApp returns
 * markup strings, so escaping, id uniqueness and anchor resolution are asserted
 * directly on the output for all seven languages (the exact markup
 * scripts/build.ts pre-renders into dist/).
 */

import { expect, test } from "bun:test";
import { escapeHtml } from "./dom.ts";
import {
  langFromPath,
  languageNegotiationScript,
  langUrl,
  pageLang,
  pageTitle,
  renderApp,
} from "./render.ts";
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

test("langFromPath reads the language out of a URL path", () => {
  // The English root names no language — the caller applies the default.
  expect(langFromPath("/")).toBeNull();
  expect(langFromPath("/index.html")).toBeNull();

  expect(langFromPath("/fr.html")).toBe("fr");
  expect(langFromPath("/zh.html")).toBe("zh");
  // The whole point of sorting by specificity: the shorter `zh` must not win.
  expect(langFromPath("/zh-hant.html")).toBe("zh-hant");

  // Deployed under a base path (GitHub Pages project sites), and extensionless.
  expect(langFromPath("/cv/fr.html")).toBe("fr");
  expect(langFromPath("/cv/zh-hant.html")).toBe("zh-hant");
  expect(langFromPath("/cv/")).toBeNull();
  expect(langFromPath("/fr")).toBe("fr");

  // A path that merely starts with a slug is not that language.
  expect(langFromPath("/french.html")).toBeNull();
  expect(langFromPath("/zh-hans.html")).toBeNull();
});

test("pageLang lets the rendered markup outrank the URL", () => {
  // Every pre-rendered page: the two agree, and the attribute is read.
  expect(pageLang("fr", "/fr.html")).toBe("fr");
  expect(pageLang("zh-hant", "/zh-hant.html")).toBe("zh-hant");

  // The precedence itself. If the URL won here, a page whose markup is already
  // Spanish would be declared English and `init()` would hydrate against
  // markup that is not what it thinks it is.
  expect(pageLang("es", "/")).toBe("es");
  expect(pageLang("zh", "/fr.html")).toBe("zh");

  // The dev shell is served at `/` with no data-lang; so is the English root.
  expect(pageLang(undefined, "/")).toBe("en");
  expect(pageLang(undefined, "/index.html")).toBe("en");

  // No attribute: the URL answers, and English is the fallback both miss.
  expect(pageLang(undefined, "/pt.html")).toBe("pt");
  expect(pageLang(undefined, "/french.html")).toBe("en");

  // An attribute that is not a language is not a language — fall through to
  // the URL rather than trusting the DOM.
  expect(pageLang("", "/fr.html")).toBe("fr");
  expect(pageLang("zh-hans", "/pt.html")).toBe("pt");
  expect(pageLang("en-GB", "/")).toBe("en");
});

test.each([...LANGS])(
  "langFromPath inverts langUrl for %s (the two must never drift)",
  (lang) => {
    const path = lang === "en" ? "/" : `/${langUrl(lang)}`;
    expect(langFromPath(path) ?? "en").toBe(lang);
  },
);

/**
 * Runs the root page's real negotiation script against a stubbed browser and
 * reports where it would send the visitor — null meaning it stays on the root.
 * The script ships as a string of ES5, so this executes the shipped source
 * itself rather than a second copy of the rule.
 */
function negotiationTarget(
  languages: readonly string[],
  saved: string | null,
): string | null {
  const source = languageNegotiationScript()
    .replace(/^<script>/, "")
    .replace(/<\/script>$/, "");
  let target: string | null = null;
  new Function("navigator", "localStorage", "location", source)(
    { languages, language: languages[0] ?? "" },
    { getItem: () => saved },
    { replace: (url: string) => void (target = url) },
  );
  return target;
}

test.each(
  [
    // The browser's language decides; English is the root, so it never redirects.
    [["fr-CA"], null, "fr.html"],
    [["pt-BR"], null, "pt.html"],
    [["es-MX"], null, "es.html"],
    [["en-US"], null, null],
    // Chinese resolves by script, not by primary subtag.
    [["zh-CN"], null, "zh.html"],
    [["zh"], null, "zh.html"],
    [["zh-Hant"], null, "zh-hant.html"],
    [["zh-TW"], null, "zh-hant.html"],
    [["zh-SG"], null, "zh.html"],
    // Hong Kong and Macau read Traditional too, so they must be matched BEFORE
    // the broader Traditional test — otherwise it swallows them.
    [["zh-HK"], null, "zh-hk.html"],
    [["zh-MO"], null, "zh-hk.html"],
    // Script and region can arrive together, in any combination. An explicit
    // Hans outranks the region: a Simplified reader living in Hong Kong must
    // not be handed the Traditional page.
    [["zh-Hans"], null, "zh.html"],
    [["zh-Hans-CN"], null, "zh.html"],
    [["zh-Hans-HK"], null, "zh.html"],
    [["zh-Hans-MO"], null, "zh.html"],
    [["zh-Hans-SG"], null, "zh.html"],
    [["zh-Hant-HK"], null, "zh-hk.html"],
    [["zh-Hant-MO"], null, "zh-hk.html"],
    [["zh-Hant-TW"], null, "zh-hant.html"],
    // Cantonese is not mapped on purpose: it falls through like any other
    // unsupported tag and the reader picks a language from the switcher.
    [["yue-HK"], null, null],
    [["yue"], null, null],
    // Unsupported languages are skipped in order, not defaulted on sight.
    [["de", "fr"], null, "fr.html"],
    [["de-AT", "ja"], null, null],
    [[], null, null],
    // A hand-picked language outranks the browser list, in both directions.
    [["fr-FR"], "es", "es.html"],
    [["de"], "zh-hant", "zh-hant.html"],
    [["fr-FR"], "en", null],
    // A stored value we don't build is ignored, and the browser decides again.
    [["fr-FR"], "klingon", "fr.html"],
  ] as const,
)(
  "root negotiation: languages=%j stored=%s sends the visitor to %s",
  (languages, saved, expected) => {
    expect(negotiationTarget(languages, saved)).toBe(expected);
  },
);

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
    // Skip-link, brand, nav shortcuts, hero CTAs.
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(ids.has(href)).toBe(true);
  },
);

test.each([...LANGS])(
  "renderApp(%s): every section is labelled by a heading that exists",
  (lang) => {
    const html = renderApp(lang, "dark");
    const ids = new Set(idsOf(html));
    const labelledBy = [...html.matchAll(/ aria-labelledby="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(labelledBy.length).toBeGreaterThan(0);
    for (const id of labelledBy) expect(ids.has(id)).toBe(true);
  },
);

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
