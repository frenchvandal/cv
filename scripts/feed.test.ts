/*
 * The JSON Feed 1.1 contract, over the real translations. What the emitted
 * dist/ files look like is asserted in scripts/build.test.ts; this file is the
 * spec: required fields present, ids usable, dates in the format readers parse,
 * and every CV entry actually published.
 */

import { expect, test } from "bun:test";
import {
  FEED_VERSION,
  feedFile,
  feedJson,
  type JsonFeed,
  jsonFeed,
} from "./feed.ts";
import {
  HTML_LANG,
  type Lang,
  LANGS,
  translations,
} from "../src/translations.ts";

const SITE = "https://example.test/cv";
const page = (lang: Lang) =>
  lang === "en" ? `${SITE}/` : `${SITE}/${lang}.html`;

const feedFor = (lang: Lang): JsonFeed =>
  jsonFeed({
    lang,
    t: translations[lang],
    homePageUrl: page(lang),
    feedUrl: `${SITE}/${feedFile(lang)}`,
    favicon: `${SITE}/assets/favicon-abc123.svg`,
    published: new Map([["kapiaRgi", "2026-07-21T12:00:48+08:00"]]),
  });

test("carries the 1.1 version URL verbatim and the required fields", () => {
  const feed = feedFor("en");

  expect(feed.version).toBe("https://jsonfeed.org/version/1.1");
  expect(FEED_VERSION).toBe(feed.version);
  expect(feed.title).not.toBe("");
  expect(Array.isArray(feed.items)).toBe(true);
  // Optional but strongly recommended, and both must be absolute to be useful.
  expect(URL.canParse(feed.home_page_url)).toBe(true);
  expect(URL.canParse(feed.feed_url)).toBe(true);
});

test("publishes every experience, education and certification entry", () => {
  const t = translations.en;
  const expected = Object.keys(t.experience).length +
    Object.keys(t.education).length + 1;

  for (const lang of LANGS) {
    const feed = feedFor(lang);
    expect(feed.items).toHaveLength(expected);
    // An item without an id "must be discarded" by a reader; a duplicate id is
    // two entries collapsing into one.
    const ids = feed.items.map((item) => item.id);
    expect(ids.every((id) => id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // One or both of content_html/content_text is required.
    expect(feed.items.every((item) => item.content_text !== "")).toBe(true);
  }
});

test("every item id and url is absolute and rooted in its own page", () => {
  for (const lang of LANGS) {
    const feed = feedFor(lang);
    for (const item of feed.items) {
      expect(item.id.startsWith(`${page(lang)}#`)).toBe(true);
      expect(URL.canParse(item.url)).toBe(true);
      // The url is a section anchor that the page really carries.
      expect(item.url).toMatch(
        /#(experience|education|certifications)$/,
      );
    }
  }
});

test("date_published is RFC 3339, and absent rather than invented", () => {
  const feed = feedFor("en");
  const dated = feed.items.filter((item) => item.date_published !== undefined);

  // Only the key the fixture map carries is dated; the rest have no date at
  // all — a CV date range like "2019 – Present" is never turned into one.
  expect(dated).toHaveLength(1);
  expect(dated[0]?.id).toBe(`${SITE}/#experience-kapiaRgi`);
  expect(dated[0]?.date_published).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/,
  );
  expect(Number.isNaN(Date.parse(dated[0]!.date_published!))).toBe(false);
});

test("each language's feed speaks that language", () => {
  const titles = new Set<string>();

  for (const lang of LANGS) {
    const feed = feedFor(lang);
    expect(feed.language).toBe(HTML_LANG[lang]);
    expect(feed.description).toBe(translations[lang].meta.description);
    // 1.1's array form; the singular `author` of 1.0 is deprecated.
    expect(feed.authors[0]?.name).toBe(translations[lang].name.display);
    titles.add(feed.title);
  }

  // Seven feeds, seven distinct titles: a shared one means a language fell
  // back to another's copy.
  expect(titles.size).toBe(LANGS.length);
});

test("rejects a feed whose URLs are not absolute", () => {
  expect(() =>
    jsonFeed({
      lang: "en",
      t: translations.en,
      homePageUrl: "/",
      feedUrl: "/feed.json",
      published: new Map(),
    })
  ).toThrow("not absolute");
});

test("serializes as parseable, newline-terminated JSON", () => {
  const json = feedJson(feedFor("fr"));

  expect(json.endsWith("\n")).toBe(true);
  expect(JSON.parse(json)).toEqual(feedFor("fr"));
});

test("English takes the unsuffixed file name, every other language its tag", () => {
  expect(feedFile("en")).toBe("feed.json");
  expect(feedFile("zh-hant")).toBe("feed.zh-hant.json");
});
