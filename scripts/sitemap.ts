/*
 * sitemap.xml, to the sitemaps.org 0.9 protocol
 * (https://www.sitemaps.org/protocol.html).
 *
 * The protocol defines four fields under `<url>`; this build emits two of them
 * and the omissions are deliberate:
 *
 *   <loc>        required—the absolute URL of the page.
 *   <lastmod>    optional—"the date the linked page was last modified, not
 *                when the sitemap is generated". Taken from git (see
 *                `contentLastmod`), never from `new Date()` and never from a
 *                file mtime: a fresh CI checkout stamps every file with the
 *                checkout time, which would make the field say "modified on
 *                every deploy" for a page that has not changed in months.
 *                Omitted entirely when git cannot answer—the protocol makes
 *                the field optional, and a wrong date is worse than none.
 *   <changefreq> omitted—no honest value exists here. The protocol itself
 *                calls it a hint that "may not correlate exactly to how often
 *                they crawl the page", and the major engines dropped it.
 *   <priority>   omitted—it ranks URLs *within* the site, and nothing here
 *                outranks anything else: a home page, a CV, an index and a
 *                run of articles, in each language. The protocol is explicit
 *                that it "is not likely to influence the position of your
 *                URLs".
 *
 * hreflang alternates (the `xhtml:link` extension) are not repeated here: every
 * page already carries the full set in its <head>, generated from the same
 * LANGS loop, and one method is enough. A second copy would be one more thing
 * to keep in step.
 *
 * The one thing outside the vocabulary is the pair of `<?xml-stylesheet?>`
 * instructions, which ask a *browser* to render the file as something other
 * than a tag tree (see [scripts/sitemap-style.ts](scripts/sitemap-style.ts) for
 * why there are two, and which one survives). Both are inert to every consumer
 * that matters: crawlers parse the XML, not the PIs.
 *
 * As a CLI it reads a sitemap back the way a crawler does—same
 * HTMLRewriter-over-our-own-output shape as scripts/social-meta.ts:
 *
 *   bun scripts/sitemap.ts dist/sitemap.xml
 */

import { $ } from "bun";

/** The namespace the protocol requires on `<urlset>`. */
export const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

/**
 * The browser stylesheet this file points at, written beside it by
 * [scripts/sitemap-style.ts](scripts/sitemap-style.ts). Declared here, where
 * the reference is emitted, so that module can generate it without importing
 * back into this one.
 *
 * There used to be two. The other was XSLT 1.0, which drew the sitemap as a
 * table; Chrome removes XSLT in 158, with WebKit and Gecko agreed. Carrying it
 * meant keeping a second language in step with the site’s layout for a few
 * months of life — and it had already fallen out of step once, deducing each
 * page’s language from a file name that the move to folders had made
 * meaningless. The CSS half is not deprecated and does the same job with less.
 */
export const SITEMAP_CSS_FILE = "sitemap.css";

export interface SitemapEntry {
  /** Absolute URL, same host and same-or-deeper path as the sitemap itself. */
  loc: string;
  /** W3C Datetime—`YYYY-MM-DD` or a full timestamp with a timezone. */
  lastmod?: string;
}

/**
 * W3C Datetime, in the two shapes the protocol allows: `YYYY-MM-DD`, or a full
 * timestamp *with* a timezone designator. The shape is a regex because
 * `Date.parse` accepts far more than that (including a timeless local time);
 * `Date.parse` then rejects the shapes that are well-formed but not real days.
 */
const W3C_DATETIME =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2}))?$/;

function isW3CDatetime(value: string): boolean {
  return W3C_DATETIME.test(value) && !Number.isNaN(Date.parse(value));
}

/** The protocol’s ceiling on a single `<loc>`. */
const MAX_LOC = 2048;

/*
 * The paths whose content reaches a visitor: the shell, the app sources
 * (renderer, copy, styles, fonts), the hand-copied public assets, the article
 * corpus, and the generator that assembles the <head>. Docs, workflows and
 * this file are not here—none of them changes a byte the page delivers, and a
 * lastmod that moves for a README edit is exactly the inaccuracy that gets the
 * whole signal ignored. Tests are excluded by pathspec, written as `*.test.ts`
 * because a plain `*` crosses `/` in a git pathspec while a doubled one does
 * not (that needs `:(glob)`)—the directory-prefixed spelling silently matches
 * nothing.
 *
 * `content/` is here because the pages this date is used for are the ones that
 * list articles: publishing a post changes the home page and the writing index
 * of that language, and dating them from the renderer alone would leave both
 * claiming they had not moved since the last code change.
 */
const CONTENT_PATHS = [
  "index.html",
  "src",
  "public",
  "content",
  "scripts/build.ts",
  ":(exclude)*.test.ts",
];

/**
 * The commit date of the last change to the rendered content, as `<lastmod>`.
 * `undefined` when git cannot answer—no repository, or a shallow clone whose
 * single commit touched none of {@link CONTENT_PATHS}. Callers omit the field
 * rather than substitute a date.
 */
export async function contentLastmod(): Promise<string | undefined> {
  const git = await $`git log -1 --format=%cI -- ${CONTENT_PATHS}`
    .nothrow()
    .quiet();
  if (git.exitCode !== 0) return undefined;
  const date = git.stdout.toString().trim();
  return isW3CDatetime(date) ? date : undefined;
}

/**
 * When one article was last touched, from its own source file.
 *
 * An article changes on its own schedule, so dating it from the site-wide
 * `contentLastmod` would claim every article was modified whenever anything
 * else was — the same inaccuracy that gets the whole signal ignored. A clone
 * that cannot answer yields nothing rather than a guess, exactly as above.
 */
export async function postLastmod(
  sourcePath: string,
): Promise<string | undefined> {
  const git = await $`git log -1 --format=%cI -- ${sourcePath}`
    .nothrow()
    .quiet();
  if (git.exitCode !== 0) return undefined;
  const date = git.stdout.toString().trim();
  return isW3CDatetime(date) ? date : undefined;
}

/**
 * `base` is the directory the sitemap is served from (no trailing slash). The
 * protocol scopes a sitemap to its own location—it "can include URLs starting
 * with http://example.com/catalog/ but not those in parent directories"—so a
 * `loc` outside it throws here instead of shipping a file crawlers reject.
 *
 * Values go through `Bun.escapeHTML`, which covers all five characters the
 * protocol’s escaping table lists; it writes `'` as `&#x27;` where the table
 * shows `&apos;`, the same character by a numeric reference (no URL here
 * contains one either way).
 */
export function sitemapXml(
  base: string,
  entries: readonly SitemapEntry[],
): string {
  const prefix = `${base.replace(/\/+$/, "")}/`;
  const body = entries.map(({ loc, lastmod }) => {
    if (!URL.canParse(loc)) {
      throw new Error(`sitemap: <loc> not absolute: ${loc}`);
    }
    if (loc.length >= MAX_LOC) {
      throw new Error(`sitemap: <loc> exceeds ${MAX_LOC} characters: ${loc}`);
    }
    if (!loc.startsWith(prefix)) {
      throw new Error(`sitemap: <loc> outside ${prefix}: ${loc}`);
    }
    if (lastmod !== undefined && !isW3CDatetime(lastmod)) {
      throw new Error(`sitemap: <lastmod> is not a W3C Datetime: ${lastmod}`);
    }
    const mod = lastmod === undefined
      ? ""
      : `\n    <lastmod>${Bun.escapeHTML(lastmod)}</lastmod>`;
    return `  <url>\n    <loc>${Bun.escapeHTML(loc)}</loc>${mod}\n  </url>`;
  }).join("\n");

  // 50,000 URLs / 50 MB is the per-file ceiling; a hundred pages will not
  // approach it, so there is no sitemap index and no gzip variant. The
  // stylesheet href is relative and resolves against the sitemap’s own URL—the
  // two files are written side by side, so the site can still move to any host
  // or base path.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/css" href="${SITEMAP_CSS_FILE}"?>\n<urlset xmlns="${SITEMAP_NS}">\n${body}\n</urlset>\n`;
}

/**
 * Read a sitemap back—element text only, which is all `<loc>`/`<lastmod>`
 * are. HTMLRewriter is an HTML parser, not an XML one, but these tags carry no
 * attributes and no namespace prefixes, so it sees exactly what a crawler’s
 * parser sees.
 *
 * Values come back escaped exactly as written, the same convention as
 * [scripts/social-meta.ts](scripts/social-meta.ts): lol-html hands back raw
 * text, and a decoder here would be a second escaping convention to keep in
 * step with the encoder. The URLs this build emits contain nothing escapable.
 */
export async function parseSitemap(xml: string): Promise<SitemapEntry[]> {
  const entries: { loc: string; lastmod: string }[] = [];
  // Text arrives in chunks, so append to the entry the enclosing <url> opened.
  const append = (field: "loc" | "lastmod") => ({
    text(chunk: HTMLRewriterTypes.Text) {
      const entry = entries.at(-1);
      if (entry) entry[field] += chunk.text;
    },
  });

  await new HTMLRewriter()
    .on("url", { element: () => void entries.push({ loc: "", lastmod: "" }) })
    .on("loc", append("loc"))
    .on("lastmod", append("lastmod"))
    .transform(new Response(xml))
    .text();

  return entries.map(({ loc, lastmod }) => ({
    loc: loc.trim(),
    ...(lastmod.trim() ? { lastmod: lastmod.trim() } : {}),
  }));
}

if (import.meta.main) {
  const files = Bun.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: bun scripts/sitemap.ts <sitemap.xml> […]");
    process.exit(1);
  }
  for (const file of files) {
    console.log(`\n${file}`);
    console.log(await parseSitemap(await Bun.file(file).text()));
  }
}
