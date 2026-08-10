/*
 * Build smoke test: run the real SSG (scripts/build.ts) and assert the emitted
 * dist/ pages carry their pre-rendered content, SEO head tags and font rules—
 * the contract deploys rely on. A full bundle plus eight pre-renders costs
 * ~110ms locally; the explicit timeout is headroom for a cold CI runner, not a
 * sign this is slow. SITE_URL is stripped from the env so the assertions don’t
 * depend on the caller’s setup.
 */

import { $ } from "bun";
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { HTML_LANG, LANGS, translations } from "../src/translations.ts";
import { escapeHtml } from "../src/dom.ts";
import { headMeta, pageMeta } from "../src/meta.ts";
import { extractSocialTags, previewCard } from "./social-meta.ts";
import { contentLastmod, parseSitemap, SITEMAP_CSS_FILE } from "./sitemap.ts";
import { FEED_MIME, FEED_VERSION, feedFile } from "./feed.ts";
import { loadPosts } from "./content.ts";
import { byLang } from "../src/post.ts";

const ROOT = `${import.meta.dir}/..`;

/**
 * Whether this checkout can answer git history questions. In a shallow clone
 * (or outside a repository) the pickaxe lookups used for <lastmod> and
 * date_published return nothing, and the assertions below would compare empty
 * to empty—green without saying anything. When history IS there, dates must
 * be found, so a silent regression in those lookups turns red instead.
 */
const hasHistory = await $`git rev-parse --is-shallow-repository`
  .cwd(ROOT)
  .quiet()
  .nothrow()
  .text()
  .then((out) => out.trim() === "false", () => false);

/*
 * Where a language’s pages live in dist/. English sits at the site root and
 * every other language in its own folder, so these are not siblings and the
 * depth differs — which is exactly what the asset-path assertions below check.
 */
const homeFile = (lang: string) =>
  lang === "en" ? "index.html" : `${lang}/index.html`;
/** The CV page, which is what carries the pre-rendered chapters. */
const outFile = (lang: string) => lang === "en" ? "cv.html" : `${lang}/cv.html`;
const blogIndexFile = (lang: string) =>
  lang === "en" ? "blog/index.html" : `${lang}/blog/index.html`;

/** How many elements a selector matches in a page—1 for every head tag here. */
async function countMatches(html: string, selector: string): Promise<number> {
  let n = 0;
  await new HTMLRewriter()
    .on(selector, { element: () => void n++ })
    .transform(new Response(html))
    .text();
  return n;
}

/** An element’s text content, appended chunk by chunk as lol-html streams it. */
async function textOf(html: string, selector: string): Promise<string> {
  let text = "";
  await new HTMLRewriter()
    .on(selector, { text: (chunk) => void (text += chunk.text) })
    .transform(new Response(html))
    .text();
  return text;
}

test(
  "bun scripts/build.ts emits every language page complete and well-formed",
  async () => {
    const { SITE_URL: _stripped, ...env } = process.env;
    const proc = Bun.spawn(["bun", "scripts/build.ts"], {
      cwd: ROOT,
      env,
      stdout: "inherit",
      stderr: "inherit",
    });
    expect(await proc.exited).toBe(0);

    for (const lang of LANGS) {
      const file = outFile(lang);
      const html = await Bun.file(`${ROOT}/dist/${file}`).text();

      // Pre-rendered, language-tagged document (proves renderApp ran).
      expect(html).toContain(`<html lang="${HTML_LANG[lang]}"`);
      expect(html).toContain(`data-lang="${lang}"`);
      expect(html).toContain("<h1");
      expect(html).toContain('class="kp"');

      // Head contract: font rules, canonical, hreflang alternates + x-default.
      expect(html).toContain("@font-face");
      expect(html).toContain('rel="canonical"');
      expect(html).toContain('hreflang="x-default"');

      // No duplicate ids in the shipped page.
      const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
      expect(new Set(ids).size).toBe(ids.length);

      // Without SITE_URL there is no absolute base, so the image tags stay off
      // entirely rather than shipping a relative URL no scraper can resolve—
      // and the card degrades to `summary`, which needs none.
      const tags = await extractSocialTags(html);
      expect(tags.og.image).toBeUndefined();
      expect(tags.twitter.image).toBeUndefined();
      expect(tags.twitter.card).toBe("summary");
    }

    for (const extra of ["404.html", "robots.txt", "og-image.png"]) {
      expect(existsSync(`${ROOT}/dist/${extra}`)).toBe(true);
    }

    // A sitemap and a feed need absolute URLs, so without SITE_URL there is
    // neither—and nothing may advertise a file that was not written.
    expect(existsSync(`${ROOT}/dist/sitemap.xml`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/feed.json`)).toBe(false);
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .not.toContain("Sitemap:");
    for (const lang of LANGS) {
      const html = await Bun.file(`${ROOT}/dist/${outFile(lang)}`).text();
      expect(html).not.toContain(FEED_MIME);
    }

    // Every language also gets a home and a blog index.
    for (const lang of LANGS) {
      expect(existsSync(`${ROOT}/dist/${homeFile(lang)}`)).toBe(true);
      expect(existsSync(`${ROOT}/dist/${blogIndexFile(lang)}`)).toBe(true);
    }

    /*
     * A relay stands at each URL the flat layout used to serve, so a link
     * shared before the move still lands somewhere. It must not shadow the
     * root, which is a real page — the one that negotiates.
     */
    for (const lang of LANGS) {
      const relay = await Bun.file(`${ROOT}/dist/${lang}.html`).text();
      expect(relay).toContain('name="robots" content="noindex"');
      expect(relay).toContain(
        `<link rel="canonical" href="${
          lang === "en" ? "./" : `./${lang}/`
        }" />`,
      );
      expect(relay).toContain('http-equiv="refresh"');
    }
    expect(await Bun.file(`${ROOT}/dist/index.html`).text())
      .not.toContain('content="noindex"');

    // Only the site root negotiates the visitor’s language: a URL that names a
    // language must always be honoured, or a shared link would change language
    // on the recipient.
    const root = await Bun.file(`${ROOT}/dist/index.html`).text();
    expect(root).toContain("location.replace");
    for (const file of ["cv.html", "fr/index.html", "fr/blog/index.html"]) {
      expect(await Bun.file(`${ROOT}/dist/${file}`).text())
        .not.toContain("location.replace");
    }

    /*
     * Asset URLs are relative and therefore depth-dependent — one "../" too
     * many produces a page that reads fine and 404s in the browser, which no
     * string comparison catches. Every reference is resolved against its own
     * page and checked to exist.
     */
    const pages = new Bun.Glob("**/*.html");
    let references = 0;
    for await (const page of pages.scan(`${ROOT}/dist`)) {
      const html = await Bun.file(`${ROOT}/dist/${page}`).text();
      for (const [, href] of html.matchAll(/"((?:\.\.?\/)+assets\/[^"]+)"/g)) {
        const resolved = new URL(href!, `file:///${page}`).pathname.slice(1);
        references++;
        expect(
          existsSync(`${ROOT}/dist/${resolved}`),
          `${page} → ${href}`,
        ).toBe(true);
      }
    }
    expect(references).toBeGreaterThan(0);
  },
  120_000,
);

/*
 * The deploy shape (deploy.yaml sets SITE_URL from the Pages base URL), read
 * back through the same HTMLRewriter a scraper’s parser stands in for. The tags
 * only exist to be consumed by machines we never see, so asserting them by
 * substring is how a card silently loses a field; `previewCard` resolves them
 * with the scrapers’ own precedence instead. dist/ is left holding these test
 * URLs—both workflows rebuild after `bun test`, so nothing deploys them.
 */
test(
  "the SITE_URL build ships a complete, per-language social card",
  async () => {
    const SITE = "https://social.example/cv";
    const proc = Bun.spawn(["bun", "scripts/build.ts"], {
      cwd: ROOT,
      env: { ...process.env, SITE_URL: SITE },
      stdout: "inherit",
      stderr: "inherit",
    });
    expect(await proc.exited).toBe(0);

    const seen = { title: new Set<string>(), locale: new Set<string>() };

    for (const lang of LANGS) {
      const file = outFile(lang);
      const html = await Bun.file(`${ROOT}/dist/${file}`).text();
      const tags = await extractSocialTags(html);
      const card = previewCard(tags);
      // The CV page keeps its file name in the URL; only indexes are published
      // as directory URLs.
      const url = `${SITE}/${file}`;
      const t = translations[lang];

      /*
       * The card is this language’s, and points at this language’s page. The
       * CV names itself rather than carrying the site title: the home, the CV
       * and the writing index used to ship one identical title and
       * description across all three, which is a duplicate in a search result
       * and a writing index presenting itself as a CV.
       */
      expect(card.title).toBe(escapeHtml(`${t.nav.cv} — ${t.name.display}`));
      expect(card.description).not.toBe(escapeHtml(t.meta.description));
      expect(card.description.length).toBeGreaterThan(0);
      expect(card.url).toBe(url);
      expect(tags.canonical).toBe(url);
      expect(card.type).toBe("website");
      expect(card.locale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);

      // A large-image card needs an image that resolves without the page: the
      // shipped tag must already be absolute, so previewCard has nothing to
      // resolve and hands back exactly what was written.
      expect(tags.og.image).toBe(`${SITE}/og-image.png`);
      expect(card.image).toBe(tags.og.image);
      expect(tags.og["image:width"]).toBe("1200");
      expect(tags.og["image:height"]).toBe("630");
      expect(tags.og["image:alt"]).toBe(card.title);
      expect(card.card).toBe("summary_large_image");
      expect(tags.twitter.image).toBe(tags.og.image);

      // The JSON-LD is the one head tag no scraper vocabulary covers, so
      // `extractSocialTags` never looked at it and nothing has read it back:
      // a Person that kept English’s jobTitle on all seven pages would ship
      // silently. Compared against the shared builder, which is also what the
      // runtime writes on a language switch.
      const meta = pageMeta(lang, url);
      const ld = await textOf(html, 'script[type="application/ld+json"]');
      expect(ld).toBe(meta.jsonLd);
      const person = JSON.parse(ld);
      expect(person.jobTitle).toBe(t.hero.title);
      expect(person.url).toBe(url);

      // Every element the runtime aims at on a reload-free switch
      // ([src/main.ts](src/main.ts)) has to exist here, exactly once. A
      // selector matching nothing fails silently—`querySelector` returns null,
      // the update is skipped, and the switched page keeps the previous
      // language’s canonical, card or Person with no error anywhere.
      for (const { selector } of headMeta(meta)) {
        expect([selector, await countMatches(html, selector)])
          .toEqual([selector, 1]);
      }

      seen.title.add(card.description);
      seen.locale.add(card.locale ?? "");
    }

    /*
     * Seven pages, seven distinct previews: a shared description or locale
     * would mean a language fell back to another’s metadata.
     *
     * The check is on the description, not the title. Since the CV page names
     * itself, its title is the word for "CV" plus the author’s name — and that
     * word is identical in English, French, Portuguese and Spanish, so four
     * titles legitimately coincide. The description is prose, and prose is
     * translated.
     */
    expect(seen.title.size).toBe(LANGS.length);
    expect(seen.locale.size).toBe(LANGS.length);

    /*
     * The sitemap lists every page that was written, once, at its canonical
     * URL — home, CV and blog index for each language, plus one entry per
     * article. 404.html is noindex and stays out. Indexes are published as
     * directory URLs, so the English home is the bare base.
     */
    const sitemap = await Bun.file(`${ROOT}/dist/sitemap.xml`).text();
    const entries = await parseSitemap(sitemap);
    const locs = new Set(entries.map((e) => e.loc));

    // The three fixed pages every language always has. Article URLs are not
    // listed here: they follow the corpus, and the canonical cross-check below
    // is what proves none of them is missing.
    for (const lang of LANGS) {
      const base = lang === "en" ? SITE : `${SITE}/${lang}`;
      expect(locs).toContain(`${base}/`);
      expect(locs).toContain(`${base}/cv.html`);
      expect(locs).toContain(`${base}/blog/`);
    }
    // Once each: a duplicate entry is a page a crawler would have to discard.
    expect(locs.size).toBe(entries.length);

    /*
     * Every canonical the pages declare is in the sitemap, and nothing in the
     * sitemap is missing from the pages. Read off dist/ rather than rebuilt
     * from LANGS, so a page emitted without a canonical fails here instead of
     * quietly disagreeing with the file that advertises it.
     */
    const pages = new Bun.Glob("**/*.html");
    const canonicals = new Set<string>();
    for await (const page of pages.scan(`${ROOT}/dist`)) {
      const html = await Bun.file(`${ROOT}/dist/${page}`).text();
      // `noindex` is what separates a page from a relay or the 404: the
      // sitemap lists what crawlers should index, and nothing else. Keyed on
      // the marker rather than on file names, so a relay added later is
      // excluded without this test having to learn its name.
      if (html.includes('name="robots" content="noindex"')) continue;
      const tags = await extractSocialTags(html);
      if (tags.canonical) canonicals.add(tags.canonical);
    }
    expect(new Set(entries.map((e) => e.loc))).toEqual(canonicals);

    /*
     * lastmod is the content’s date from git, not the build’s — the whole
     * point of the field. The fixed pages share the site’s own date; an
     * article carries the date of its own source file, so that editing one
     * post does not re-date the other ninety-five.
     *
     * A date can legitimately be absent: a shallow clone cannot answer, and
     * neither can git for a file that is not committed yet. Absent is the
     * honest answer, and far better than the build’s own clock.
     */
    const lastmod = await contentLastmod();
    const fixed = LANGS.flatMap((lang) => {
      const base = lang === "en" ? SITE : `${SITE}/${lang}`;
      return [`${base}/`, `${base}/cv.html`, `${base}/blog/`];
    });
    for (const entry of entries) {
      if (fixed.includes(entry.loc)) expect(entry.lastmod).toBe(lastmod);
      if (entry.lastmod) {
        expect(Date.parse(entry.lastmod)).toBeLessThanOrEqual(Date.now());
      }
    }
    if (lastmod) {
      expect(Date.parse(lastmod)).toBeLessThanOrEqual(Date.now());
    }
    // Independent truth: with history available, the field must exist. The
    // loop above compares the build’s answer to the same function’s answer,
    // so a broken git lookup would otherwise pass vacuously (undefined ===
    // undefined) in exactly the shallow clones the gates used to run.
    if (hasHistory) expect(lastmod).toBeDefined();

    // The browser stylesheet ships beside the sitemap that references it: a
    // dangling reference is a console error on a file whose whole job is to be
    // machine-read without incident.
    expect(sitemap).toContain(`href="${SITEMAP_CSS_FILE}"`);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(true);
    // The XSLT half is gone; nothing may still advertise it.
    expect(sitemap).not.toContain("text/xsl");
    expect(existsSync(`${ROOT}/dist/sitemap.xsl`)).toBe(false);

    // robots.txt points crawlers at it, absolutely.
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .toContain(`Sitemap: ${SITE}/sitemap.xml`);

    /*
     * One JSON Feed per language, discoverable from its own page. The items
     * are the articles, dated from their own frontmatter — explicit and
     * author-chosen, so unlike the git lookup this replaced, the depth of the
     * clone cannot empty them.
     *
     * A language with no article gets an empty feed, which is valid and
     * honest: it says there is nothing rather than pointing at another
     * language’s writing. Rather than assert one shape or the other, each
     * feed is compared against the corpus the build itself read — titles and
     * order included — so an empty feed passes only where the corpus is
     * empty, and a feed that invented an item fails everywhere.
     */
    const corpus = await loadPosts();
    for (const lang of LANGS) {
      const feed = await Bun.file(`${ROOT}/dist/${feedFile(lang)}`).json();
      expect(feed.version).toBe(FEED_VERSION);
      expect(feed.feed_url).toBe(`${SITE}/${feedFile(lang)}`);
      // The feed’s home is the language’s home page, published as a directory
      // URL like every other index.
      expect(feed.home_page_url).toBe(
        lang === "en" ? `${SITE}/` : `${SITE}/${lang}/`,
      );
      expect(Array.isArray(feed.items)).toBe(true);
      expect(feed.items.map((item: { title: string }) => item.title)).toEqual(
        byLang(corpus, lang).map((post) => post.title),
      );
      // Every item carries a date, and it is the article’s own — never
      // synthesized, never absent.
      for (const item of feed.items) {
        expect(item.date_published).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);
        expect(item.id).toBe(item.url);
      }
      // Nothing from the CV survives in the feed: a subscriber wants the
      // writing, not a republished career record.
      expect(JSON.stringify(feed)).not.toContain("Kapia");
      // The bundler emits a hashed favicon; the feed must point at that asset,
      // not at the source path the shell references.
      expect(feed.favicon).toMatch(
        new RegExp(`^${SITE}/assets/favicon-[^/]+\\.svg$`),
      );

      // Discovery: the page declares the feed with the spec’s type.
      const html = await Bun.file(`${ROOT}/dist/${outFile(lang)}`).text();
      expect(html).toContain(
        `<link rel="alternate" type="${FEED_MIME}" title=`,
      );
      expect(html).toContain(`href="${SITE}/${feedFile(lang)}"`);
    }
  },
  120_000,
);
