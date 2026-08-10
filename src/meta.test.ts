/*
 * meta.ts unit tests—the per-language <head> contract, shared by the SSG and
 * the runtime. The whole point of the module is that one language switch
 * produces the same head twice: pre-rendered by
 * [scripts/build.ts](scripts/build.ts) on first load, rewritten by
 * [src/main.ts](src/main.ts) when the visitor switches without a reload. These
 * tests pin the values; [scripts/build.test.ts](scripts/build.test.ts) pins
 * that every selector below actually hits an element in the shipped page.
 */

import { expect, test } from "bun:test";
import { headMeta, pageMeta, pageUrl } from "./meta.ts";
import { langUrl, pageTitle } from "./render.ts";
import {
  type Lang,
  LANGS,
  PROFILE,
  SAME_AS,
  translations,
} from "./translations.ts";

const SITE = "https://social.example/cv";
const url = (lang: Lang) =>
  lang === "en" ? `${SITE}/` : `${SITE}/${langUrl(lang)}`;

test("pageMeta carries this language’s title, description and page URL", () => {
  const meta = pageMeta("fr", url("fr"));
  const t = translations.fr;

  expect(meta.title).toBe(pageTitle(t));
  expect(meta.description).toBe(t.meta.description);
  expect(meta.url).toBe("https://social.example/cv/fr/");
  // Values are unescaped—the SSG escapes them into the template, the runtime
  // hands them to setAttribute, which escapes nothing.
  expect(meta.title).not.toContain("&amp;");
});

test("every language gets its own Open Graph locale", () => {
  const locales = LANGS.map((lang) => pageMeta(lang, url(lang)).ogLocale);

  // Open Graph wants underscores, not BCP-47 hyphens.
  for (const locale of locales) expect(locale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
  expect(new Set(locales).size).toBe(LANGS.length);

  // The three Chinese pages are the ones a shared locale would silently merge.
  expect(pageMeta("zh", url("zh")).ogLocale).toBe("zh_CN");
  expect(pageMeta("zh-hant", url("zh-hant")).ogLocale).toBe("zh_TW");
  expect(pageMeta("zh-hk", url("zh-hk")).ogLocale).toBe("zh_HK");
});

test("the JSON-LD Person is this language’s, and parses", () => {
  for (const lang of LANGS) {
    const t = translations[lang];
    const person = JSON.parse(pageMeta(lang, url(lang)).jsonLd);

    expect(person["@type"]).toBe("Person");
    expect(person.name).toBe(PROFILE.fullName);
    expect(person.alternateName).toBe(PROFILE.chineseName);
    // The one field that must follow the switch: the job title is translated.
    expect(person.jobTitle).toBe(t.hero.title);
    expect(person.url).toBe(url(lang));
    expect(person.sameAs).toEqual([...SAME_AS]);
    expect(person.address.addressLocality).toBe(PROFILE.address.locality);
    expect(person.knowsLanguage).toEqual([...PROFILE.knowsLanguage]);
  }
});

test("the JSON-LD carries no raw `<`, which would close its own script tag", () => {
  // The value is written into <script>…</script> by the SSG, so a `<` in any
  // translation would end the block early and spill markup onto the page.
  const meta = pageMeta("en", url("en"));
  expect(meta.jsonLd).not.toContain("<");
  // Escaped as a JSON string escape, so a parser still sees the character.
  expect(JSON.parse(`"\\u003C"`)).toBe("<");
});

test("pageUrl absolutizes the CV page it switches to, from the one it is on", () => {
  // The runtime has no SITE_URL: the canonical it writes has to be resolved
  // from wherever the page is actually served.
  expect(pageUrl("en", "fr", "https://social.example/cv/cv.html")).toBe(
    "https://social.example/cv/fr/cv.html",
  );
  /*
   * The one this had to be rewritten for. Languages are folders now, so the
   * link between two CV pages is depth-dependent: from `fr/cv.html` the Hong
   * Kong page is `../zh-hk/cv.html`. Resolving a root-relative `zh-hk/`
   * against the French page would have produced `/cv/fr/zh-hk/` — a 404 the
   * flat layout could not produce.
   */
  expect(pageUrl("fr", "zh-hk", "https://social.example/cv/fr/cv.html")).toBe(
    "https://social.example/cv/zh-hk/cv.html",
  );
  // Back to English, which is the only language with no folder of its own.
  expect(pageUrl("fr", "en", "https://social.example/cv/fr/cv.html")).toBe(
    "https://social.example/cv/cv.html",
  );
  // Query and hash belong to the visit, not to the page’s identity.
  expect(
    pageUrl("en", "pt", "https://social.example/cv/cv.html?utm=x#experience"),
  ).toBe("https://social.example/cv/pt/cv.html");
});

test("headMeta names one head element per value, and nothing twice", () => {
  const updates = headMeta(pageMeta("fr", url("fr")));
  const selectors = updates.map((u) => u.selector);

  expect(selectors).toEqual([
    "title",
    'meta[name="description"]',
    'link[rel="canonical"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[property="og:locale"]',
    'meta[property="og:image:alt"]',
    'script[type="application/ld+json"]',
  ]);
  expect(new Set(selectors).size).toBe(selectors.length);

  // Text nodes for the two elements that carry no content attribute.
  const attrs = new Map(updates.map((u) => [u.selector, u.attr]));
  expect(attrs.get("title")).toBe("text");
  expect(attrs.get('script[type="application/ld+json"]')).toBe("text");
  expect(attrs.get('link[rel="canonical"]')).toBe("href");
  expect(attrs.get('meta[property="og:url"]')).toBe("content");
});

test("headMeta values are the page’s, not the previous language’s", () => {
  const french = new Map(
    headMeta(pageMeta("fr", url("fr"))).map((u) => [u.selector, u.value]),
  );

  expect(french.get("title")).toBe(pageTitle(translations.fr));
  expect(french.get('meta[property="og:title"]')).toBe(
    pageTitle(translations.fr),
  );
  // The alt text of the shared preview image is the card’s own title.
  expect(french.get('meta[property="og:image:alt"]')).toBe(
    pageTitle(translations.fr),
  );
  expect(french.get('link[rel="canonical"]')).toBe(
    "https://social.example/cv/fr/",
  );
  expect(french.get('meta[property="og:url"]')).toBe(
    french.get('link[rel="canonical"]'),
  );

  // No English left anywhere in the French head.
  const english = headMeta(pageMeta("en", url("en"))).map((u) => u.value);
  for (const value of french.values()) expect(english).not.toContain(value);
});
