/*
 * The generator's protocol contract, asserted through `parseSitemap` — the
 * sitemap only exists to be read by machines we never see, so it is checked by
 * something that reads it back rather than by substring. The build-output side
 * (which URLs, which dates) lives in scripts/build.test.ts, on the dist/ the
 * real build wrote.
 */

import { expect, test } from "bun:test";
import { parseSitemap, SITEMAP_NS, sitemapXml } from "./sitemap.ts";
import { sitemapCss, sitemapXsl } from "./sitemap-style.ts";
import { HTML_LANG, LANG_NAME, LANGS } from "../src/translations.ts";

const BASE = "https://example.test/cv";
const ENTRIES = [
  { loc: `${BASE}/`, lastmod: "2026-07-27T23:25:06+08:00" },
  { loc: `${BASE}/fr.html`, lastmod: "2026-07-27T23:25:06+08:00" },
];

test("emits a well-formed urlset that reads back entry for entry", async () => {
  const xml = sitemapXml(BASE, ENTRIES);

  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
  expect(xml).toContain(`<urlset xmlns="${SITEMAP_NS}">`);
  expect(xml.endsWith("</urlset>\n")).toBe(true);
  expect(await parseSitemap(xml)).toEqual(ENTRIES);
});

test("<lastmod> is optional and absent, not empty, when not supplied", async () => {
  const xml = sitemapXml(BASE, [{ loc: `${BASE}/` }]);

  expect(xml).not.toContain("lastmod");
  expect(await parseSitemap(xml)).toEqual([{ loc: `${BASE}/` }]);
});

test("the fields the protocol makes optional and useless are not emitted", () => {
  const xml = sitemapXml(BASE, ENTRIES);

  expect(xml).not.toContain("changefreq");
  expect(xml).not.toContain("priority");
});

test("escapes a <loc> per the protocol's entity table", async () => {
  const loc = `${BASE}/x.html?a=1&b='2'&c="3"&d=<4>`;

  const xml = sitemapXml(BASE, [{ loc }]);
  const inner = xml.match(/<loc>(.*)<\/loc>/)?.[1] ?? "";
  // No raw delimiter survives, and every `&` opens an entity reference.
  expect(inner).not.toMatch(/[<>"']/);
  expect(inner).not.toMatch(/&(?!(amp|lt|gt|quot|#x27);)/);
  // parseSitemap returns text as written, so it is the escaped form that must
  // round-trip — the URLs this build emits contain nothing escapable at all.
  expect(await parseSitemap(xml)).toEqual([{ loc: inner }]);
});

test("points a browser at both stylesheets without disturbing a parser", async () => {
  const xml = sitemapXml(BASE, ENTRIES);

  // Where processing instructions belong: after the declaration, before the
  // root element, and relative so the set moves to any host or base path. XSL
  // first — a browser that still runs XSLT must take that one, and only a
  // browser that has dropped it falls through to the CSS.
  expect(xml).toMatch(
    /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<\?xml-stylesheet type="text\/xsl" href="sitemap\.xsl"\?>\n<\?xml-stylesheet type="text\/css" href="sitemap\.css"\?>\n<urlset/,
  );
  // And they are invisible to everything that reads the sitemap as a sitemap.
  expect(await parseSitemap(xml)).toEqual(ENTRIES);
});

test("the CSS fallback is bound to the sitemap namespace", () => {
  const css = sitemapCss();

  // Without this, every selector below matches nothing and the fallback
  // silently renders as the browser's bare XML tree.
  expect(css.startsWith(`@namespace url(${SITEMAP_NS});`)).toBe(true);
  for (const selector of ["urlset", "url", "loc", "lastmod"]) {
    expect(css).toContain(`\n${selector} {`);
  }
});

test("the stylesheet names every language the site publishes", () => {
  const xsl = sitemapXsl();

  expect(xsl.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
  // Version and namespaces are the whole contract with the browser: any other
  // version, or a template bound to no namespace, transforms to a blank page.
  expect(xsl).toContain('<xsl:stylesheet version="1.0"');
  expect(xsl).toContain(`xmlns:s="${SITEMAP_NS}"`);

  for (const lang of LANGS) {
    // The file names spelled out, not derived from `langUrl` a second time —
    // this is the assertion that a language page renamed on one side and not
    // the other has to fail against.
    const file = lang === "en" ? "" : `${lang}.html`;
    expect(xsl).toContain(`test="$file = '${file}'"`);
    expect(xsl).toContain(
      `<span lang="${HTML_LANG[lang]}">${LANG_NAME[lang]}</span>`,
    );
  }
});

test("rejects anything the protocol would make a crawler discard", () => {
  // Not absolute.
  expect(() => sitemapXml(BASE, [{ loc: "/fr.html" }])).toThrow("not absolute");
  // Another host, or a parent directory of the sitemap's own location.
  expect(() => sitemapXml(BASE, [{ loc: "https://elsewhere.test/fr.html" }]))
    .toThrow("outside");
  expect(() => sitemapXml(BASE, [{ loc: "https://example.test/fr.html" }]))
    .toThrow("outside");
  // Over 2,048 characters.
  expect(() => sitemapXml(BASE, [{ loc: `${BASE}/${"x".repeat(2048)}` }]))
    .toThrow("2048");
  // Not a W3C Datetime (US order, no timezone, month 13).
  for (
    const lastmod of [
      "07/27/2026",
      "2026-07-27T23:25:06",
      "2026-13-01T00:00:00Z",
    ]
  ) {
    expect(() => sitemapXml(BASE, [{ loc: `${BASE}/`, lastmod }]))
      .toThrow("W3C Datetime");
  }
});
