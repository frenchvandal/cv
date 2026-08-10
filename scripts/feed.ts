/*
 * JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/)—one feed per
 * language, written next to the pages by scripts/build.ts under SITE_URL.
 *
 * WHAT THE ITEMS ARE. The site is a blog now, so the items are the articles:
 * a subscriber wants the writing, not the republication of a career record,
 * and the CV entries that used to fill this feed are gone from it. Each
 * language's feed carries exactly the articles that exist in it—no more, no
 * translations that were never written. The set is read off the corpus
 * (scripts/content.ts), so publishing an article puts it in the feed with no
 * second list to update.
 *
 * THE FIELDS, top level:
 *   version        required—the 1.1 URL, verbatim.
 *   title          the page title, `pageTitle(t)`—the same string the <title>
 *                  carries, so a subscriber sees the name they bookmarked.
 *   home_page_url  the language's home page. Optional in the spec, "strongly
 *                  recommended".
 *   feed_url       this file's own absolute URL—also the feed's identifier,
 *                  which is why the whole feed is gated on SITE_URL: a
 *                  relative one identifies nothing.
 *   description    t.meta.description, the same sentence the <meta> carries.
 *   user_comment   the spec's field for whoever opens the raw JSON in a
 *                  browser. English on every feed on purpose: it addresses the
 *                  person debugging the file, not the reader.
 *   favicon        the site icon, as emitted (hashed) by the bundler. It is an
 *                  SVG of viewBox 48x46 where the spec asks for a square
 *                  raster "not smaller than 64 x 64"—near enough that a
 *                  reader renders it correctly, and it is the only icon this
 *                  project has. `icon` (the 512x512 timeline image) is omitted
 *                  rather than pointed at og-image.png, which is a 1200x630
 *                  social card and would be letterboxed or cropped.
 *   language       HTML_LANG[lang]—the same RFC 5646 tag as <html lang>.
 *   authors        1.1's array form (1.0's singular `author` is deprecated).
 *                  The name is the localized display name, so the Chinese
 *                  feeds are authored by 李北洛, as those pages are.
 *   items          required. A language without articles gets an empty list,
 *                  which is valid—and honest: the feed says there is nothing
 *                  rather than pointing at another language's writing.
 *   expired        omitted—the feed is live. `next_url` and `hubs` too: a
 *                  handful of items needs no pagination, and a static host has
 *                  no hub to push from.
 *
 * THE FIELDS, per item:
 *   id             required, and the one field a reader cannot recover from:
 *                  the article's absolute URL. Stable, unique, and exactly
 *                  what a subscriber bookmarks.
 *   url            the same URL—the article's own page.
 *   title          the frontmatter title, as the page's <h1> shows it.
 *   content_html   the article's rendered body—the same markup the page
 *                  carries, already validated by the pipeline's guard.
 *   summary        the frontmatter summary (or the one derived from the
 *                  text), the line worth showing collapsed.
 *   date_published the frontmatter `date` at UTC midnight. It is explicit and
 *                  author-chosen, so it needs no git lookup and no history:
 *                  the clone's depth cannot empty it the way it used to.
 *   date_modified  the frontmatter `updated`, same treatment. Omitted when
 *                  the article was never updated—never synthesized.
 *   tags           the frontmatter tags.
 *   language       omitted per item: the feed carries one language, and the
 *                  top-level field already says which.
 *
 * SERVING. The spec's type is `application/feed+json`; GitHub Pages serves
 * `.json` as `application/json`, which the spec accepts. The discovery <link>
 * that scripts/build.ts injects declares the correct type either way.
 */

import { HTML_LANG, type Lang, type Translation } from "../src/translations.ts";
import type { Post } from "./content.ts";
import { byLang } from "../src/post.ts";
import { pageTitle } from "../src/render.ts";

/** The `version` value 1.1 requires; the spec reads it as the format's identity. */
export const FEED_VERSION = "https://jsonfeed.org/version/1.1";
/**
 * The type the spec registers, and what the `<link rel="alternate">` in
 * [scripts/build.ts](scripts/build.ts) must advertise: a reader that trusts the
 * attribute over sniffing will not subscribe to anything else.
 */
export const FEED_MIME = "application/feed+json";

export interface FeedAuthor {
  name: string;
  url?: string;
}

export interface FeedItem {
  id: string;
  url: string;
  title: string;
  content_html: string;
  summary: string;
  date_published: string;
  date_modified?: string;
  tags: string[];
}

export interface JsonFeed {
  version: string;
  title: string;
  home_page_url: string;
  feed_url: string;
  description: string;
  user_comment: string;
  favicon?: string;
  language: string;
  authors: FeedAuthor[];
  items: FeedItem[];
}

/** English is the site root's language, so its feed is the unsuffixed one. */
export function feedFile(lang: Lang): string {
  return lang === "en" ? "feed.json" : `feed.${lang}.json`;
}

export interface FeedOptions {
  lang: Lang;
  t: Translation;
  /** The whole corpus—the feed picks its language's articles out of it. */
  posts: readonly Post[];
  /** Absolute URL of this language's home page. */
  homePageUrl: string;
  /** Absolute URL of this feed—the spec's identifier for it. */
  feedUrl: string;
  /** Absolute URL of the site icon, when the bundle emitted one. */
  favicon?: string;
  /** Absolute URL of one article's page. */
  postUrl: (post: Post) => string;
}

/**
 * A frontmatter date at UTC midnight, RFC 3339 as the spec requires. The date
 * is already validated real by the frontmatter parser; the time part is the
 * neutral one, not an invented hour of day.
 */
function rfc3339(date: string): string {
  return `${date}T00:00:00Z`;
}

/**
 * One language's feed: its articles, newest first, with their rendered HTML.
 * Throws when a URL is not absolute—a feed is consumed away from the site,
 * where a relative one resolves against nothing.
 */
export function jsonFeed(options: FeedOptions): JsonFeed {
  const { lang, t, posts, homePageUrl, feedUrl, favicon, postUrl } = options;

  for (const url of [homePageUrl, feedUrl]) {
    if (!URL.canParse(url)) throw new Error(`feed: URL not absolute: ${url}`);
  }

  const items: FeedItem[] = byLang(posts, lang).map((post) => {
    const url = postUrl(post);
    if (!URL.canParse(url)) throw new Error(`feed: URL not absolute: ${url}`);
    return {
      id: url,
      url,
      title: post.title,
      content_html: post.html,
      summary: post.summary,
      date_published: rfc3339(post.date),
      ...(post.updated ? { date_modified: rfc3339(post.updated) } : {}),
      tags: [...post.tags],
    };
  });

  // An item a reader must discard, or two items it would collapse into one.
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error("feed: duplicate item id");

  return {
    version: FEED_VERSION,
    title: pageTitle(t),
    home_page_url: homePageUrl,
    feed_url: feedUrl,
    description: t.meta.description,
    user_comment:
      "A JSON Feed (https://jsonfeed.org/) of this site's writing. One feed " +
      "per language; see the alternate links in the page head.",
    ...(favicon ? { favicon } : {}),
    language: HTML_LANG[lang],
    authors: [{ name: t.name.display, url: homePageUrl }],
    items,
  };
}

/** Two-space JSON, newline-terminated—a feed is often read by hand. */
export function feedJson(feed: JsonFeed): string {
  return `${JSON.stringify(feed, null, 2)}\n`;
}
