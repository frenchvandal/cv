/*
 * Build smoke test: run the real SSG (scripts/build.ts) and assert the emitted
 * dist/ pages carry their pre-rendered content, SEO head tags and font rules—
 * the contract deploys rely on. A full bundle plus the pre-renders costs a few
 * hundred ms locally; the explicit timeout is headroom for a cold CI runner,
 * not a sign this is slow. SITE_URL is stripped from the env so the assertions
 * don't depend on the caller's setup.
 */

import { $ } from "bun";
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { HTML_LANG, LANGS, translations } from "../src/translations.ts";
import { escapeHtml } from "../src/dom.ts";
import { pageTitle } from "../src/render.ts";
import { headMeta, pageMeta } from "../src/meta.ts";
import { byLang, langsOf } from "../src/post.ts";
import { pagePath } from "../src/urls.ts";
import { extractSocialTags, previewCard } from "./social-meta.ts";
import { loadPosts } from "./content.ts";
import {
  contentLastmod,
  parseSitemap,
  SITEMAP_CSS_FILE,
  SITEMAP_XSL_FILE,
} from "./sitemap.ts";
import { FEED_MIME, FEED_VERSION, feedFile } from "./feed.ts";

const ROOT = `${import.meta.dir}/..`;

/**
 * Whether this checkout can answer git history questions. In a shallow clone
 * (or outside a repository) the git lookups used for <lastmod> return nothing,
 * and the assertions below would compare empty to empty—green without saying
 * anything. When history IS there, dates must be found, so a silent regression
 * in those lookups turns red instead.
 */
const hasHistory = await $`git rev-parse --is-shallow-repository`
  .cwd(ROOT)
  .quiet()
  .nothrow()
  .text()
  .then((out) => out.trim() === "false", () => false);

/** The corpus the build reads, so the expected pages are derived, not guessed. */
const posts = await loadPosts();

/** The three fixed files of one language, relative to dist/. */
const fixedFiles = (lang: string) =>
  ["index.html", "cv.html", "blog/index.html"].map((file) =>
    lang === "en" ? file : `${lang}/${file}`
  );

/** How many elements a selector matches in a page—1 for every head tag here. */
async function countMatches(html: string, selector: string): Promise<number> {
  let n = 0;
  await new HTMLRewriter()
    .on(selector, { element: () => void n++ })
    .transform(new Response(html))
    .text();
  return n;
}

/** An element's text content, appended chunk by chunk as lol-html streams it. */
async function textOf(html: string, selector: string): Promise<string> {
  let text = "";
  await new HTMLRewriter()
    .on(selector, { text: (chunk) => void (text += chunk.text) })
    .transform(new Response(html))
    .text();
  return text;
}

test(
  "bun scripts/build.ts emits every page complete and well-formed",
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
      for (const file of fixedFiles(lang)) {
        expect(await Bun.file(`${ROOT}/dist/${file}`).exists()).toBe(true);
      }
      for (const post of byLang(posts, lang)) {
        const file = pagePath({ kind: "post", lang, slug: post.slug });
        expect(await Bun.file(`${ROOT}/dist/${file}`).exists()).toBe(true);
      }

      // The CV page: pre-rendered, language-tagged document with its head
      // contract—font rules, canonical, hreflang alternates + x-default.
      const prefix = lang === "en" ? "" : `${lang}/`;
      const cv = await Bun.file(`${ROOT}/dist/${prefix}cv.html`).text();
      expect(cv).toContain(`<html lang="${HTML_LANG[lang]}"`);
      expect(cv).toContain(`data-lang="${lang}"`);
      expect(cv).toContain('data-kind="cv"');
      expect(cv).toContain("<h1");
      expect(cv).toContain('class="kp"');
      expect(cv).toContain("@font-face");
      expect(cv).toContain('rel="canonical"');
      expect(cv).toContain('hreflang="x-default"');

      // No duplicate ids in the shipped page.
      const ids = [...cv.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
      expect(new Set(ids).size).toBe(ids.length);

      // Without SITE_URL there is no absolute base, so the image tags stay off
      // entirely rather than shipping a relative URL no scraper can resolve—
      // and the card degrades to `summary`, which needs none.
      const tags = await extractSocialTags(cv);
      expect(tags.og.image).toBeUndefined();
      expect(tags.twitter.image).toBeUndefined();
      expect(tags.twitter.card).toBe("summary");
    }

    // Asset paths are relative to each page's depth.
    const root = await Bun.file(`${ROOT}/dist/index.html`).text();
    const nested = await Bun.file(`${ROOT}/dist/fr/blog/index.html`).text();
    expect(root).toContain('"./assets/');
    expect(root).not.toContain('"../assets/');
    expect(nested).toContain('"../../assets/');
    expect(nested).not.toContain('"./assets/');

    // No page references an asset that was not emitted.
    const glob = new Bun.Glob("**/*.html");
    for await (const page of glob.scan(`${ROOT}/dist`)) {
      const html = await Bun.file(`${ROOT}/dist/${page}`).text();
      for (const [, href] of html.matchAll(/"((?:\.\.?\/)+assets\/[^"]+)"/g)) {
        const resolved = new URL(href ?? "", `file:///${page}`).pathname
          .slice(1);
        expect(
          await Bun.file(`${ROOT}/dist/${resolved}`).exists(),
          `${page} → ${href}`,
        ).toBe(true);
      }
    }

    for (const extra of ["404.html", "robots.txt", "og-image.png"]) {
      expect(existsSync(`${ROOT}/dist/${extra}`)).toBe(true);
    }

    // A sitemap and a feed need absolute URLs, so without SITE_URL there is
    // neither—and nothing may advertise a file that was not written.
    expect(existsSync(`${ROOT}/dist/sitemap.xml`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_XSL_FILE}`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/feed.json`)).toBe(false);
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .not.toContain("Sitemap:");
    expect(root).not.toContain(FEED_MIME);

    // Only the site root negotiates the visitor's language.
    expect(root).toContain("location.replace");
    for (const file of ["fr/index.html", "cv.html", "blog/index.html"]) {
      const html = await Bun.file(`${ROOT}/dist/${file}`).text();
      expect(html).not.toContain("location.replace");
    }

    // The old language URLs are relay pages: canonical to the new location,
    // noindex, zero-second refresh.
    for (const lang of LANGS.filter((l) => l !== "en")) {
      const relay = await Bun.file(`${ROOT}/dist/${lang}.html`).text();
      expect(relay).toContain('content="noindex"');
      expect(relay).toContain(
        `<link rel="canonical" href="./${lang}/index.html"`,
      );
    }
    const enRelay = await Bun.file(`${ROOT}/dist/en.html`).text();
    expect(enRelay).toContain('<link rel="canonical" href="./index.html"');
  },
  120_000,
);

/*
 * The deploy shape (deploy.yaml sets SITE_URL from the Pages base URL), read
 * back through the same HTMLRewriter a scraper's parser stands in for. The tags
 * only exist to be consumed by machines we never see, so asserting them by
 * substring is how a card silently loses a field; `previewCard` resolves them
 * with the scrapers' own precedence instead. dist/ is left holding these test
 * URLs—both workflows rebuild after `bun test`, so nothing deploys them.
 */
test(
  "the SITE_URL build ships complete social cards, sitemap and feeds",
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
      const prefix = lang === "en" ? "" : `${lang}/`;
      const home = await Bun.file(`${ROOT}/dist/${prefix}index.html`).text();
      const tags = await extractSocialTags(home);
      const card = previewCard(tags);
      const url = `${SITE}/${prefix}`;
      const t = translations[lang];

      // The card is this language's, and points at this language's page.
      expect(card.title).toBe(escapeHtml(pageTitle(t)));
      expect(card.description).toBe(escapeHtml(t.meta.description));
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
      // a Person that kept English's jobTitle on all seven pages would ship
      // silently. Compared against the shared builder, which is also what the
      // runtime writes on a language switch.
      const meta = pageMeta(lang, url);
      const ld = await textOf(home, 'script[type="application/ld+json"]');
      expect(ld).toBe(meta.jsonLd);

      // Every element the runtime aims at on a reload-free switch
      // ([src/main.ts](src/main.ts)) has to exist here, exactly once. A
      // selector matching nothing fails silently—`querySelector` returns null,
      // the update is skipped, and the switched page keeps the previous
      // language's canonical, card or Person with no error anywhere.
      for (const { selector } of headMeta(meta)) {
        expect([selector, await countMatches(home, selector)])
          .toEqual([selector, 1]);
      }

      seen.title.add(card.title);
      seen.locale.add(card.locale ?? "");
    }

    // Seven home pages, seven distinct previews: a shared title or locale
    // would mean a language fell back to another's metadata.
    expect(seen.title.size).toBe(LANGS.length);
    expect(seen.locale.size).toBe(LANGS.length);

    // An article page: its own title and summary, its own canonical, and
    // hreflang only for the languages it exists in.
    const article = posts.find((p) => p.lang === "fr")!;
    const frPost = await Bun.file(
      `${ROOT}/dist/fr/blog/${article.slug}.html`,
    ).text();
    const postTags = await extractSocialTags(frPost);
    expect(postTags.canonical).toBe(`${SITE}/fr/blog/${article.slug}.html`);
    expect(postTags.og.title).toBe(
      escapeHtml(`${article.title} — ${translations.fr.name.display}`),
    );
    expect(postTags.og.description).toBe(escapeHtml(article.summary));
    const alternateCount = await countMatches(
      frPost,
      'link[rel="alternate"][hreflang]',
    );
    // The article's languages, plus x-default.
    expect(alternateCount).toBe(langsOf(posts, article.slug).length + 1);

    // The sitemap lists every real page once, and no relay: en.html and the
    // <lang>.html files are duplicates pointing at the new locations.
    const sitemap = await Bun.file(`${ROOT}/dist/sitemap.xml`).text();
    const entries = await parseSitemap(sitemap);
    const locs = entries.map((e) => e.loc);
    expect(locs).toContain(`${SITE}/`);
    expect(locs).toContain(`${SITE}/cv.html`);
    expect(locs).toContain(`${SITE}/fr/blog/index.html`);
    expect(locs).toContain(`${SITE}/fr/blog/${article.slug}.html`);
    expect(locs.some((l) => l.endsWith("/fr.html"))).toBe(false);
    expect(locs.some((l) => l.endsWith("/en.html"))).toBe(false);
    expect(locs).toHaveLength(LANGS.length * 3 + posts.length);

    // lastmod is the content's date from git, not the build's—the whole
    // point of the field. An article is dated by its own source file.
    const lastmod = await contentLastmod();
    for (const entry of entries) {
      if (!entry.lastmod) continue;
      expect(Date.parse(entry.lastmod)).toBeLessThanOrEqual(Date.now());
    }
    const articleEntry = entries.find((e) =>
      e.loc === `${SITE}/fr/blog/${article.slug}.html`
    );
    expect(articleEntry?.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    if (hasHistory) expect(lastmod).toBeDefined();

    // Both browser stylesheets ship beside the sitemap that references them,
    // and the XSLT one reads the language off the first path segment: a <loc>
    // the transform has no case for renders a blank language cell.
    const xsl = await Bun.file(`${ROOT}/dist/${SITEMAP_XSL_FILE}`).text();
    expect(sitemap).toContain(`href="${SITEMAP_XSL_FILE}"`);
    expect(sitemap).toContain(`href="${SITEMAP_CSS_FILE}"`);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(true);
    for (const lang of LANGS.filter((l) => l !== "en")) {
      expect(xsl).toContain(`contains(s:loc, '/${lang}/')`);
    }

    // robots.txt points crawlers at it, absolutely.
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .toContain(`Sitemap: ${SITE}/sitemap.xml`);

    // One JSON Feed per language, discoverable from its home page: the items
    // are that language's articles, dated from their frontmatter.
    for (const lang of LANGS) {
      const feed = await Bun.file(`${ROOT}/dist/${feedFile(lang)}`).json();
      const expected = byLang(posts, lang);
      expect(feed.version).toBe(FEED_VERSION);
      expect(feed.feed_url).toBe(`${SITE}/${feedFile(lang)}`);
      expect(feed.items).toHaveLength(expected.length);
      for (const [i, item] of feed.items.entries()) {
        const post = expected[i]!;
        expect(item.id).toBe(
          `${SITE}/${pagePath({ kind: "post", lang, slug: post.slug })}`,
        );
        expect(item.date_published).toBe(`${post.date}T00:00:00Z`);
        expect(item.content_html).toContain("<p>");
      }
      // The bundler emits a hashed favicon; the feed must point at that asset,
      // not at the source path the shell references.
      expect(feed.favicon).toMatch(
        new RegExp(`^${SITE}/assets/favicon-[^/]+\\.svg$`),
      );

      // Discovery: the home page declares the feed with the spec's type.
      const prefix = lang === "en" ? "" : `${lang}/`;
      const home = await Bun.file(`${ROOT}/dist/${prefix}index.html`).text();
      expect(home).toContain(
        `<link rel="alternate" type="${FEED_MIME}" title=`,
      );
      expect(home).toContain(`href="${SITE}/${feedFile(lang)}"`);
    }
  },
  120_000,
);
