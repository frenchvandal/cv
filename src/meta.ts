/*
 * The per-language <head>: title, description, canonical, Open Graph and the
 * JSON-LD Person.
 *
 * It exists because the head is written twice for the same page. The SSG
 * ([scripts/build.ts](scripts/build.ts)) bakes it into every pre-rendered file,
 * and the runtime ([src/main.ts](src/main.ts)) rewrites it when the visitor
 * switches language without a reload—`history.pushState` moves the URL to
 * `fr.html`, so a head still describing English leaves the document describing
 * a page the address bar no longer points at.
 *
 * Keeping the values here means the two can't drift: `pageMeta` is what the
 * build interpolates, and `headMeta` is the same values addressed by the
 * selector each one lives at, which is all the runtime needs to apply them.
 * [scripts/build.test.ts](scripts/build.test.ts) asserts every selector below
 * matches exactly one element in the shipped page—the one failure this split
 * could still produce.
 */

import { langUrl, pageTitle } from "./render.ts";
import { type Lang, PROFILE, SAME_AS, translations } from "./translations.ts";

/** Open Graph wants underscore locales, not BCP-47 tags. */
const OG_LOCALE: Record<Lang, string> = {
  en: "en_US",
  fr: "fr_FR",
  pt: "pt_PT",
  es: "es_ES",
  zh: "zh_CN",
  "zh-hant": "zh_TW",
  "zh-hk": "zh_HK",
};

/**
 * Everything in the head that changes with the language. Values are unescaped:
 * the SSG runs them through `escapeHtml` into its template, the runtime hands
 * them to `setAttribute`, which escapes nothing. `jsonLd` is the exception—it
 * is already serialized, and carries its own escaping (see below).
 */
export interface PageMeta {
  title: string;
  description: string;
  /** The page's own public URL: canonical and `og:url` both. */
  url: string;
  ogLocale: string;
  /** Serialized `Person`, safe to drop straight into a `<script>` block. */
  jsonLd: string;
}

/**
 * `url` is the page's public URL—absolute when the build runs with SITE_URL,
 * and resolved against `location` at runtime. It is passed in rather than
 * derived because only the caller knows the deployed base.
 */
export function pageMeta(lang: Lang, url: string): PageMeta {
  const t = translations[lang];
  return {
    title: pageTitle(t),
    description: t.meta.description,
    url,
    ogLocale: OG_LOCALE[lang],
    jsonLd: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: PROFILE.fullName,
      alternateName: PROFILE.chineseName,
      jobTitle: t.hero.title,
      url,
      sameAs: SAME_AS,
      address: {
        "@type": "PostalAddress",
        addressLocality: PROFILE.address.locality,
        addressCountry: PROFILE.address.country,
      },
      knowsLanguage: PROFILE.knowsLanguage,
      // A raw `<` in any translation would close the surrounding <script> early
      // and spill the rest of the object onto the page as markup. Escaped as a
      // JSON string escape, so a parser still reads the character.
    }).replace(/</g, "\\u003C"),
  };
}

/** One head element's value, addressed by where it lives. */
export interface HeadMeta {
  /** CSS selector of the single element carrying this value. */
  selector: string;
  /** Attribute to set, or `"text"` to replace the element's text content. */
  attr: string;
  value: string;
}

/**
 * The same values, addressed for the runtime. `og:image:alt` is on the list
 * although a SITE_URL-less build omits the image tags entirely: a selector that
 * matches nothing is skipped by the caller, which is cheaper than teaching the
 * runtime which build shape it is running in.
 */
export function headMeta(meta: PageMeta): HeadMeta[] {
  return [
    { selector: "title", attr: "text", value: meta.title },
    {
      selector: 'meta[name="description"]',
      attr: "content",
      value: meta.description,
    },
    { selector: 'link[rel="canonical"]', attr: "href", value: meta.url },
    {
      selector: 'meta[property="og:title"]',
      attr: "content",
      value: meta.title,
    },
    {
      selector: 'meta[property="og:description"]',
      attr: "content",
      value: meta.description,
    },
    { selector: 'meta[property="og:url"]', attr: "content", value: meta.url },
    {
      selector: 'meta[property="og:locale"]',
      attr: "content",
      value: meta.ogLocale,
    },
    {
      selector: 'meta[property="og:image:alt"]',
      attr: "content",
      value: meta.title,
    },
    {
      selector: 'script[type="application/ld+json"]',
      attr: "text",
      value: meta.jsonLd,
    },
  ];
}

/**
 * The public URL of a language's page, resolved against the document switching
 * to it. The runtime has no SITE_URL to read, and `langUrl` is relative, so the
 * page it is switching *from* is the only base available—which is also the
 * right one: it carries whatever host and base path the site was deployed at.
 * Query and hash are dropped; they belong to the visit, not to the page.
 */
export function pageUrl(lang: Lang, base: string): string {
  return new URL(langUrl(lang), base).href;
}
