/*
 * JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/)—one feed per
 * language, written next to the pages by scripts/build.ts under SITE_URL.
 *
 * WHAT THE ITEMS ARE. A CV is not a blog, so the first question is what counts
 * as an item. The answer here is the professional record—the entries the CV
 * states as discrete, dated facts: the five roles, the three schools, and the
 * certifications block. Skills, hobbies, the dialogue and the contact section
 * are prose and tag clouds; they are chapters of one document, not items, and
 * publishing them would be padding a feed to look busy. The item set is read
 * back off the translation objects (`Object.entries`), so a role added to
 * src/translations.ts is in the feed with no second list to update.
 *
 * THE FIELDS, top level:
 *   version        required—the 1.1 URL, verbatim.
 *   title          the page title, `pageTitle(t)`—the same string the <title>
 *                  carries, so a subscriber sees the name they bookmarked.
 *   home_page_url  the language's page. Optional in the spec, "strongly
 *                  recommended".
 *   feed_url       this file's own absolute URL—also the feed's identifier,
 *                  which is why the whole feed is gated on SITE_URL: a
 *                  relative one identifies nothing.
 *   description    t.meta.description, the same sentence the <meta> carries.
 *   user_comment   the spec's field for whoever opens the raw JSON in a
 *                  browser. English on every feed on purpose: it addresses the
 *                  person debugging the file, not the reader of the CV.
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
 *   items          required.
 *   expired        omitted—the feed is live. `next_url` and `hubs` too:
 *                  nine items need no pagination, and a static host has no hub
 *                  to push from.
 *
 * THE FIELDS, per item:
 *   id             required, and the one field a reader cannot recover from:
 *                  `<page>#<section>-<key>`, built from the translation key,
 *                  which is language-independent and survives the copy being
 *                  rewritten. Unique per feed, stable over time.
 *   url            the section anchor that actually exists on the page
 *                  (`#experience`), not the id's finer fragment.
 *   title          role—employer, or diploma—school.
 *   content_text   the entry's own remaining fields, one per line. `text`
 *                  rather than `content_html` because these entries are flat
 *                  strings: emitting HTML would mean a second escaping path
 *                  for no gain, and the spec takes either.
 *   summary        the one line worth showing collapsed—the employer's
 *                  sector, or the school's subtitle. Absent where the entry
 *                  has neither.
 *   date_published from git (see `entryPublished`), never from the entry's own
 *                  date range: `TimelineEntry.date` in src/render.ts is free
 *                  text ("2019 – Present", "2019 – 至今"), localized, and it
 *                  says when the *job* started, which is not when the item was
 *                  published. Turning "2019" into 2019-01-01T00:00:00Z would
 *                  invent both a day and a meaning.
 *   date_modified  omitted—git can date an entry's first appearance but not
 *                  a later edit to its wording (the copy lines do not contain
 *                  the key the pickaxe searches for), and a date_modified that
 *                  only ever equals date_published is noise.
 *   tags           the localized section name, the CV's own categorization.
 *   language       omitted per item: the feed carries one language, and the
 *                  top-level field already says which.
 *
 * SERVING. The spec's type is `application/feed+json`; GitHub Pages serves
 * `.json` as `application/json`, which the spec accepts. The discovery <link>
 * that scripts/build.ts injects declares the correct type either way.
 */

import { $ } from "bun";
import { HTML_LANG, type Lang, type Translation } from "../src/translations.ts";
import { pageTitle } from "../src/render.ts";

/** The `version` value 1.1 requires; the spec reads it as the format's identity. */
export const FEED_VERSION = "https://jsonfeed.org/version/1.1";
/**
 * The type the spec registers, and what the `<link rel="alternate">` in
 * [scripts/build.ts](scripts/build.ts) must advertise: a reader that trusts the
 * attribute over sniffing will not subscribe to anything else.
 */
export const FEED_MIME = "application/feed+json";

/**
 * RFC 3339, which is stricter than the sitemap's W3C Datetime: a bare
 * `YYYY-MM-DD` is a legal `<lastmod>` but not a legal `date_published`.
 */
const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;

export interface FeedAuthor {
  name: string;
  url?: string;
}

export interface FeedItem {
  id: string;
  url: string;
  title: string;
  content_text: string;
  summary?: string;
  date_published?: string;
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

/** A CV entry, flattened out of whichever section shape it came from. */
interface Entry {
  /** Translation key—language-independent, hence the id and the git needle. */
  key: string;
  section: "experience" | "education" | "certifications";
  title: string;
  /** `content_text`, one line per element. */
  lines: string[];
  summary?: string;
}

/**
 * The published entries, in the order the CV lists them (newest first—object
 * key order in src/translations.ts is the reverse-chronological order the
 * renderer walks). Read from the translation rather than a hand-kept list, so
 * the feed cannot fall behind the page.
 */
function entries(t: Translation): Entry[] {
  // Middle dot, not the em dash `pageTitle` uses: CJK copy carries its own
  // double dash ("商學學位——金融方向"), and a second one would read as part of
  // the title rather than as the separator before the employer.
  const experience = Object.entries(t.experience).map(([key, e]) => ({
    key,
    section: "experience" as const,
    title: `${e.title} · ${e.company}`,
    lines: [e.date, e.location, e.sector],
    summary: e.sector,
  }));

  // The three education entries do not share one shape: only Sichuan has
  // `items`, only the two French schools have `desc`, EDC has no subtitle.
  const education = Object.entries(t.education).map(([key, e]) => ({
    key,
    section: "education" as const,
    title: `${e.title} · ${e.school}`,
    lines: [
      e.date,
      ...("subtitle" in e ? [e.subtitle] : []),
      ...("desc" in e ? [e.desc] : []),
      ...("items" in e ? e.items : []),
    ],
    ...("subtitle" in e ? { summary: e.subtitle } : {}),
  }));

  return [...experience, ...education, {
    key: "certifications",
    section: "certifications" as const,
    title: t.nav.certifications,
    lines: [t.certifications.date, ...t.certifications.items],
  }];
}

/**
 * When each entry first appeared on the site, as `date_published`.
 *
 * `git log -S` (the pickaxe) reports the commits that change how many times a
 * string occurs in a file; the first of them is the commit that introduced the
 * entry. The needle is the entry's object-literal key (`kapiaRgi: {`), which is
 * language-independent—one lookup dates the item in all seven feeds—and
 * survives the copy being rewritten, since only a rename of the key itself
 * moves the date. That coupling to the source's shape is the cost, and the
 * reason a missing answer degrades to an omitted field rather than a guess: no
 * repository, a shallow clone, or a reformatted literal all return undefined.
 */
export async function entryPublished(
  t: Translation,
): Promise<Map<string, string>> {
  const dates = await Promise.all(
    entries(t).map(async ({ key }) => {
      const git =
        await $`git log --reverse --format=%cI -S${`${key}: {`} -- src/translations.ts`
          .nothrow()
          .quiet();
      const first = git.exitCode === 0
        ? git.stdout.toString().split("\n")[0]?.trim() ?? ""
        : "";
      return [key, first] as const;
    }),
  );
  return new Map(dates.filter(([, date]) => RFC_3339.test(date)));
}

export interface FeedOptions {
  lang: Lang;
  t: Translation;
  /** Absolute URL of this language's page. */
  homePageUrl: string;
  /** Absolute URL of this feed—the spec's identifier for it. */
  feedUrl: string;
  /** Absolute URL of the site icon, when the bundle emitted one. */
  favicon?: string;
  /** Entry key → RFC 3339, from {@link entryPublished}. */
  published: ReadonlyMap<string, string>;
}

/**
 * One language's feed. The items are read off the translation object rather
 * than a list kept here, so a new role or school appears in all seven feeds by
 * being written once; `date_published` is only set for the entries
 * {@link entryPublished} could date, and is omitted for the rest rather than
 * guessed. Throws when a URL is not absolute—a feed is consumed away from the
 * site, where a relative one resolves against nothing.
 */
export function jsonFeed(options: FeedOptions): JsonFeed {
  const { lang, t, homePageUrl, feedUrl, favicon, published } = options;

  for (const url of [homePageUrl, feedUrl]) {
    if (!URL.canParse(url)) throw new Error(`feed: URL not absolute: ${url}`);
  }

  const items = entries(t).map(({ key, section, title, lines, summary }) => {
    const date = published.get(key);
    // Certifications are one item for the whole section, so its key *is* the
    // section—no `#certifications-certifications`.
    const fragment = key === section ? section : `${section}-${key}`;
    return {
      id: `${homePageUrl}#${fragment}`,
      url: `${homePageUrl}#${section}`,
      title,
      content_text: lines.join("\n"),
      ...(summary ? { summary } : {}),
      ...(date ? { date_published: date } : {}),
      tags: [t.nav[section]],
    };
  });

  // An item a reader must discard, or two items it would collapse into one.
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error("feed: duplicate item id");
  if (items.some((item) => !item.content_text)) {
    throw new Error("feed: item with empty content_text");
  }

  return {
    version: FEED_VERSION,
    title: pageTitle(t),
    home_page_url: homePageUrl,
    feed_url: feedUrl,
    description: t.meta.description,
    user_comment:
      "A JSON Feed (https://jsonfeed.org/) of the professional record on this " +
      "CV — roles, schools and certifications. One feed per language; see the " +
      "alternate links in the page head.",
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
