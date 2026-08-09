/*
 * render.ts unit tests—the pure SSG core. No DOM needed: renderApp returns
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

test("langUrl points at a language's home, relative to the site root", () => {
  // English is the root; the rest are folders, published as directory URLs so
  // they match the canonical the page itself declares.
  expect(langUrl("en")).toBe("./");
  expect(langUrl("fr")).toBe("fr/");
  expect(langUrl("zh")).toBe("zh/");
  expect(langUrl("zh-hant")).toBe("zh-hant/");
});

test("langFromPath reads the language out of a URL path", () => {
  // The English root names no language—the caller applies the default.
  expect(langFromPath("/")).toBeNull();
  expect(langFromPath("/index.html")).toBeNull();
  expect(langFromPath("/cv.html")).toBeNull();
  expect(langFromPath("/blog/mesurer.html")).toBeNull();

  // The language is a folder, and no longer the last segment: an article path
  // ends in its slug, and a CV path in a file name.
  expect(langFromPath("/fr/")).toBe("fr");
  expect(langFromPath("/fr/cv.html")).toBe("fr");
  expect(langFromPath("/fr/blog/index.html")).toBe("fr");
  expect(langFromPath("/fr/blog/mesurer-le-texte.html")).toBe("fr");
  // Segments are compared whole, so the shorter `zh` cannot claim `zh-hant`.
  expect(langFromPath("/zh-hant/blog/mesurer.html")).toBe("zh-hant");

  // Deployed under a base path (a project site), which the scan finds anyway
  // because it never assumes which segment the language sits in.
  expect(langFromPath("/cv/fr/cv.html")).toBe("fr");
  expect(langFromPath("/cv/")).toBeNull();

  // A segment that merely starts with a language code is not that language —
  // and an article can never be called `fr`, because assertSlug reserves it.
  expect(langFromPath("/french/")).toBeNull();
  expect(langFromPath("/zh-hans/")).toBeNull();
});

test("pageLang lets the rendered markup outrank the URL", () => {
  // Every pre-rendered page: the two agree, and the attribute is read.
  expect(pageLang("fr", "/fr/cv.html")).toBe("fr");
  expect(pageLang("zh-hant", "/zh-hant/")).toBe("zh-hant");

  // The precedence itself. If the URL won here, a page whose markup is already
  // Spanish would be declared English and `init()` would hydrate against
  // markup that is not what it thinks it is.
  expect(pageLang("es", "/")).toBe("es");
  expect(pageLang("zh", "/fr/")).toBe("zh");

  // The dev shell is served at `/` with no data-lang; so is the English root.
  expect(pageLang(undefined, "/")).toBe("en");
  expect(pageLang(undefined, "/index.html")).toBe("en");

  // No attribute: the URL answers, and English is the fallback both miss.
  expect(pageLang(undefined, "/pt/cv.html")).toBe("pt");
  expect(pageLang(undefined, "/french/")).toBe("en");

  // An attribute that is not a language is not a language—fall through to
  // the URL rather than trusting the DOM.
  expect(pageLang("", "/fr/")).toBe("fr");
  expect(pageLang("zh-hans", "/pt/blog/index.html")).toBe("pt");
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
 * reports where it would send the visitor—null meaning it stays on the root.
 * The script ships as a string of ES5, so this executes the shipped source
 * itself rather than a second copy of the rule.
 */
function negotiationTarget(
  languages: readonly string[],
  saved: string | null,
  from: { search?: string; hash?: string } = {},
): string | null {
  const source = languageNegotiationScript()
    .replace(/^<script>/, "")
    .replace(/<\/script>$/, "");
  let target: string | null = null;
  new Function("navigator", "localStorage", "location", source)(
    { languages, language: languages[0] ?? "" },
    { getItem: () => saved },
    {
      search: from.search ?? "",
      hash: from.hash ?? "",
      replace: (url: string) => void (target = url),
    },
  );
  return target;
}

test.each(
  [
    // The browser's language decides; English is the root, so it never redirects.
    [["fr-CA"], null, "fr/"],
    [["pt-BR"], null, "pt/"],
    [["es-MX"], null, "es/"],
    [["en-US"], null, null],
    // Chinese resolves by script, not by primary subtag.
    [["zh-CN"], null, "zh/"],
    [["zh"], null, "zh/"],
    [["zh-Hant"], null, "zh-hant/"],
    [["zh-TW"], null, "zh-hant/"],
    [["zh-SG"], null, "zh/"],
    // Hong Kong and Macau read Traditional too, so they must be matched BEFORE
    // the broader Traditional test—otherwise it swallows them.
    [["zh-HK"], null, "zh-hk/"],
    [["zh-MO"], null, "zh-hk/"],
    // Script and region can arrive together, in any combination. An explicit
    // Hans outranks the region: a Simplified reader living in Hong Kong must
    // not be handed the Traditional page.
    [["zh-Hans"], null, "zh/"],
    [["zh-Hans-CN"], null, "zh/"],
    [["zh-Hans-HK"], null, "zh/"],
    [["zh-Hans-MO"], null, "zh/"],
    [["zh-Hans-SG"], null, "zh/"],
    [["zh-Hant-HK"], null, "zh-hk/"],
    [["zh-Hant-MO"], null, "zh-hk/"],
    [["zh-Hant-TW"], null, "zh-hant/"],
    // Cantonese carries no script of its own, so only the region decides:
    // Hong Kong and Macau read the Traditional page written for them.
    [["yue-HK"], null, "zh-hk/"],
    [["yue-MO"], null, "zh-hk/"],
    [["yue-Hant-HK"], null, "zh-hk/"],
    // A Cantonese speaker in Guangdong reads Simplified, and bare `yue` names
    // no region at all: both fall through rather than guess a script.
    [["yue-CN"], null, null],
    [["yue"], null, null],
    // Unsupported languages are skipped in order, not defaulted on sight.
    [["de", "fr"], null, "fr/"],
    [["de-AT", "ja"], null, null],
    [[], null, null],
    // A hand-picked language outranks the browser list, in both directions.
    [["fr-FR"], "es", "es/"],
    [["de"], "zh-hant", "zh-hant/"],
    [["fr-FR"], "en", null],
    // A stored value we don't build is ignored, and the browser decides again.
    [["fr-FR"], "klingon", "fr/"],
  ] as const,
)(
  "root negotiation: languages=%j stored=%s sends the visitor to %s",
  (languages, saved, expected) => {
    expect(negotiationTarget(languages, saved)).toBe(expected);
  },
);

/*
 * The redirect carries the rest of the URL. A root link is the one people
 * share, and it is exactly the one that gets rewritten: without this, a French
 * reader following `…/cv/#experience` landed at the top of `fr.html` with the
 * section dropped, and any campaign parameter went with it.
 */
test.each(
  [
    [{ hash: "#experience" }, "fr/#experience"],
    [{ search: "?utm_source=linkedin" }, "fr/?utm_source=linkedin"],
    [
      { search: "?a=1", hash: "#contact" },
      "fr/?a=1#contact",
    ],
    // Nothing to carry is still a bare path, not a stray "?" or "#".
    [{}, "fr/"],
  ] as const,
)("the redirect keeps %j", (from, expected) => {
  expect(negotiationTarget(["fr-FR"], null, from)).toBe(expected);
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
