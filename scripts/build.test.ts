/*
 * Build smoke test: run the real SSG (scripts/build.ts) and assert the emitted
 * dist/ pages carry their pre-rendered content, SEO head tags and font rules—
 * the contract deploys rely on. A full bundle plus eight pre-renders costs
 * ~110ms locally; the explicit timeout is headroom for a cold CI runner, not a
 * sign this is slow. SITE_URL is stripped from the env so the assertions don't
 * depend on the caller's setup.
 */

import { $ } from "bun";
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { HTML_LANG, LANGS, translations } from "../src/translations.ts";
import { escapeHtml } from "../src/dom.ts";
import { pageTitle } from "../src/render.ts";
import { extractSocialTags, previewCard } from "./social-meta.ts";
import {
  contentLastmod,
  parseSitemap,
  SITEMAP_CSS_FILE,
  SITEMAP_XSL_FILE,
} from "./sitemap.ts";
import { entryPublished, FEED_MIME, FEED_VERSION, feedFile } from "./feed.ts";

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

/** The page a language is written to, and read back from, in dist/. */
const outFile = (lang: string) => lang === "en" ? "index.html" : `${lang}.html`;

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
    expect(existsSync(`${ROOT}/dist/${SITEMAP_XSL_FILE}`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(false);
    expect(existsSync(`${ROOT}/dist/feed.json`)).toBe(false);
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .not.toContain("Sitemap:");
    for (const lang of LANGS) {
      const html = await Bun.file(`${ROOT}/dist/${outFile(lang)}`).text();
      expect(html).not.toContain(FEED_MIME);
    }

    // English is served twice: the root negotiates the visitor's language,
    // en.html is the stable URL that never does. Same page, one canonical.
    const root = await Bun.file(`${ROOT}/dist/index.html`).text();
    const english = await Bun.file(`${ROOT}/dist/en.html`).text();
    expect(root).toContain("location.replace");
    expect(english).not.toContain("location.replace");
    const canonical = (html: string) =>
      html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    expect(canonical(english)).toBe(canonical(root));
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
      const tags = await extractSocialTags(
        await Bun.file(`${ROOT}/dist/${file}`).text(),
      );
      const card = previewCard(tags);
      const url = lang === "en" ? `${SITE}/` : `${SITE}/${file}`;
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

      seen.title.add(card.title);
      seen.locale.add(card.locale ?? "");
    }

    // Eight pages, eight distinct previews: a shared title or locale would mean
    // a language fell back to another's metadata.
    expect(seen.title.size).toBe(LANGS.length);
    expect(seen.locale.size).toBe(LANGS.length);

    // en.html is the same page as the root, so it must preview identically.
    const cardOf = async (file: string) =>
      previewCard(await extractSocialTags(await Bun.file(file).text()));
    expect(await cardOf(`${ROOT}/dist/en.html`)).toEqual(
      await cardOf(`${ROOT}/dist/index.html`),
    );

    // The sitemap lists every language page once, at its canonical URL, and
    // nothing else: en.html is a duplicate of the root and 404.html is
    // noindex. Same order as LANGS, so a diff of the file stays readable.
    const sitemap = await Bun.file(`${ROOT}/dist/sitemap.xml`).text();
    const entries = await parseSitemap(sitemap);
    expect(entries.map((e) => e.loc)).toEqual(
      LANGS.map((lang) =>
        lang === "en" ? `${SITE}/` : `${SITE}/${outFile(lang)}`
      ),
    );

    // Every canonical in the pages is in the sitemap, and vice versa.
    const canonicals = await Promise.all(
      LANGS.map(async (lang) =>
        (await extractSocialTags(
          await Bun.file(`${ROOT}/dist/${outFile(lang)}`).text(),
        )).canonical
      ),
    );
    expect(new Set(entries.map((e) => e.loc))).toEqual(new Set(canonicals));

    // lastmod is the content's date from git, not the build's—the whole
    // point of the field. Compared against the same source the build read, so
    // a checkout that cannot answer (shallow clone) expects no field at all.
    const lastmod = await contentLastmod();
    for (const entry of entries) expect(entry.lastmod).toBe(lastmod);
    if (lastmod) {
      expect(Date.parse(lastmod)).toBeLessThanOrEqual(Date.now());
    }
    // Independent truth: with history available, the field must exist. The
    // loop above compares the build's answer to the same function's answer,
    // so a broken git lookup would otherwise pass vacuously (undefined ===
    // undefined) in exactly the shallow clones the gates used to run.
    if (hasHistory) expect(lastmod).toBeDefined();

    // Both browser stylesheets ship beside the sitemap that references them,
    // and the XSLT one carries a row for every URL in it: a <loc> the transform
    // has no case for renders a blank language cell to whoever opens the file.
    const xsl = await Bun.file(`${ROOT}/dist/${SITEMAP_XSL_FILE}`).text();
    expect(sitemap).toContain(`href="${SITEMAP_XSL_FILE}"`);
    expect(sitemap).toContain(`href="${SITEMAP_CSS_FILE}"`);
    expect(existsSync(`${ROOT}/dist/${SITEMAP_CSS_FILE}`)).toBe(true);
    for (const { loc } of entries) {
      expect(xsl).toContain(`test="$file = '${loc.slice(SITE.length + 1)}'"`);
    }

    // robots.txt points crawlers at it, absolutely.
    expect(await Bun.file(`${ROOT}/dist/robots.txt`).text())
      .toContain(`Sitemap: ${SITE}/sitemap.xml`);

    // One JSON Feed per language, discoverable from its own page and dated
    // from git—the same source the sitemap's <lastmod> comes from, so a
    // checkout without history yields no date rather than a wrong one.
    const published = await entryPublished(translations.en);
    // Independent truth: the expected item count is derived from the
    // translation data, not from the code under test—so with history a git
    // lookup that silently answers nothing (reformatted literal, broken
    // pickaxe) fails here instead of passing as `0 === 0` below.
    if (hasHistory) {
      const en = translations.en;
      const itemCount = Object.keys(en.experience).length +
        Object.keys(en.education).length + 1;
      expect(published.size).toBe(itemCount);
    }
    for (const lang of LANGS) {
      const feed = await Bun.file(`${ROOT}/dist/${feedFile(lang)}`).json();
      expect(feed.version).toBe(FEED_VERSION);
      expect(feed.feed_url).toBe(`${SITE}/${feedFile(lang)}`);
      expect(feed.home_page_url).toBe(
        lang === "en" ? `${SITE}/` : `${SITE}/${outFile(lang)}`,
      );
      expect(feed.items.length).toBeGreaterThan(0);
      expect(
        feed.items.filter((i: { date_published?: string }) => i.date_published),
      ).toHaveLength(published.size);
      // The bundler emits a hashed favicon; the feed must point at that asset,
      // not at the source path the shell references.
      expect(feed.favicon).toMatch(
        new RegExp(`^${SITE}/assets/favicon-[^/]+\\.svg$`),
      );

      // Discovery: the page declares the feed with the spec's type.
      const html = await Bun.file(`${ROOT}/dist/${outFile(lang)}`).text();
      expect(html).toContain(
        `<link rel="alternate" type="${FEED_MIME}" title=`,
      );
      expect(html).toContain(`href="${SITE}/${feedFile(lang)}"`);
    }
  },
  120_000,
);
