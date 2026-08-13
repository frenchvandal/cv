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
 * Keeping the values here means the two can’t drift: `pageMeta` is what the
 * build interpolates, and `headMeta` is the same values addressed by the
 * selector each one lives at, which is all the runtime needs to apply them.
 * [scripts/build.test.ts](scripts/build.test.ts) asserts every selector below
 * matches exactly one element in the shipped page—the one failure this split
 * could still produce.
 */

import { pageTitle } from "./render.ts";
import { deriveSummary } from "./post.ts";
import { hrefTo } from "./urls.ts";
import {
  type Lang,
  PROFILE,
  SAME_AS,
  type Translation,
  translations,
} from "./translations.ts";

/**
 * Open Graph wants underscore locales, not BCP-47 tags. Exported because the
 * build also needs the locales of the OTHER languages a page exists in, for
 * `og:locale:alternate`.
 */
export const OG_LOCALE: Record<Lang, string> = {
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
  /** The page’s own public URL: canonical and `og:url` both. */
  url: string;
  ogLocale: string;
  /** The article facts, carried through so the build can emit `article:*`. */
  article?: MetaOverride["article"];
  /**
   * Serialized structured data, safe to drop straight into a `<script>` block:
   * a `Person`, or a `@graph` of the person and the post on an article page.
   */
  jsonLd: string;
}

/**
 * What a page announces about itself when it is not the CV. An article has its
 * own title and summary, and without them every blog page would present the
 * CV’s—wrong in the tab, wrong in a search result, wrong in a link preview.
 */
export interface MetaOverride {
  title: string;
  description: string;
  /**
   * The article facts, on an article page and nowhere else. They are what
   * turns the page’s structured data from “a person” into “a person who wrote
   * this, on this date”—the dates a search result shows, and the ones a reader
   * uses to judge whether a technical note is still current.
   */
  article?: {
    /**
     * The article’s own title, without the site-name suffix the tab title
     * carries: Schema.org asks for the headline, not for what a browser tab
     * shows.
     */
    headline: string;
    /** Frontmatter `date`, as `YYYY-MM-DD`. */
    published: string;
    /** Frontmatter `updated`, when the author dated a revision. */
    updated?: string;
    /** BCP-47 tag of the page, for `inLanguage`. */
    inLanguage: string;
  };
  /**
   * The site’s own home, for `Person.url`. Absent, the page URL stands in—
   * which is right for the CV, the page that IS about the person, and wrong
   * for an article, where it would claim the author’s canonical address is
   * whatever post you happen to be reading.
   */
  homeUrl?: string;
}

/** ISO 8601 with a timezone, which is what Schema.org and Open Graph want. */
function asDateTime(date: string): string {
  return `${date}T00:00:00Z`;
}

/**
 * `url` is the page’s public URL—absolute when the build runs with SITE_URL,
 * and resolved against `location` at runtime. It is passed in rather than
 * derived because only the caller knows the deployed base.
 *
 * The `Person` JSON-LD is deliberately kept on every page: it describes the
 * site’s author, who is the same whichever page is being read.
 */
/** Where search engines cut a description; the budget `cvOverride` writes to. */
export const META_DESCRIPTION_MAX = 160;

/**
 * The CV page’s own identity, shared by the two heads that must agree on it.
 *
 * The build bakes this into `cv.html`; the runtime rewrites the head when the
 * visitor switches language in place, which happens on the CV and nowhere
 * else. When only the build knew about it, that switch put the HOME’s title
 * and description back on a page whose URL said `fr/cv.html` — the drift this
 * module exists to make impossible, reintroduced by adding the override on one
 * side only.
 */
export function cvOverride(t: Translation): MetaOverride {
  return {
    title: `${t.nav.cv} — ${t.name.display}`,
    description: deriveSummary(t.about.p1, META_DESCRIPTION_MAX),
  };
}

export function pageMeta(
  lang: Lang,
  url: string,
  override?: MetaOverride,
): PageMeta {
  const t = translations[lang];
  const title = override?.title ?? pageTitle(t);
  const description = override?.description ?? t.meta.description;
  const article = override?.article;

  const person = {
    "@type": "Person",
    name: PROFILE.fullName,
    alternateName: PROFILE.chineseName,
    jobTitle: t.hero.title,
    url: override?.homeUrl ?? url,
    sameAs: SAME_AS,
    address: {
      "@type": "PostalAddress",
      addressLocality: PROFILE.address.locality,
      addressCountry: PROFILE.address.country,
    },
    knowsLanguage: PROFILE.knowsLanguage,
  };

  /*
   * One `@graph` on an article, so the post and its author are two nodes of
   * one description rather than two documents that happen to share a page.
   * The author is given as a reference to the Person node instead of a second
   * copy of it—the same fact stated twice is the fastest way to have it stated
   * two different ways later.
   */
  const graph = article
    ? {
      "@context": "https://schema.org",
      "@graph": [
        { ...person, "@id": `${override?.homeUrl ?? url}#person` },
        {
          "@type": "BlogPosting",
          headline: article.headline,
          description,
          url,
          mainEntityOfPage: url,
          inLanguage: article.inLanguage,
          datePublished: asDateTime(article.published),
          ...(article.updated
            ? { dateModified: asDateTime(article.updated) }
            : {}),
          author: { "@id": `${override?.homeUrl ?? url}#person` },
        },
      ],
    }
    : { "@context": "https://schema.org", ...person };

  return {
    title,
    description,
    url,
    ogLocale: OG_LOCALE[lang],
    ...(article ? { article } : {}),
    // A raw `<` in any translation would close the surrounding <script> early
    // and spill the rest of the object onto the page as markup. Escaped as a
    // JSON string escape, so a parser still reads the character.
    jsonLd: JSON.stringify(graph).replace(/</g, "\\u003C"),
  };
}

/** One head element’s value, addressed by where it lives. */
export interface HeadMeta {
  /** CSS selector of the single element carrying this value. */
  selector: string;
  /** Attribute to set, or `"text"` to replace the element’s text content. */
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
 * The public URL of a language’s CV page, resolved against the document
 * switching to it. The runtime has no SITE_URL to read, so the page it is
 * switching *from* is the only base available—which is also the right one: it
 * carries whatever host and base path the site was deployed at. Query and hash
 * are dropped; they belong to the visit, not to the page.
 *
 * Both languages are needed because the link between them is depth-dependent
 * now: `fr/cv.html` reaches `pt/cv.html` as `../pt/cv.html`, and resolving a
 * root-relative `pt/` against the French page would land on `fr/pt/`. Only the
 * CV is asked for, because the reload-free switch is the CV’s alone.
 */
export function pageUrl(from: Lang, to: Lang, base: string): string {
  return new URL(
    hrefTo({ kind: "cv", lang: from }, { kind: "cv", lang: to }),
    base,
  )
    .href;
}
