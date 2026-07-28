/*
 * Build smoke test: run the real SSG (scripts/build.ts) and assert the emitted
 * dist/ pages carry their pre-rendered content, SEO head tags and font rules —
 * the contract deploys rely on. A full bundle plus eight pre-renders costs
 * ~110ms locally; the explicit timeout is headroom for a cold CI runner, not a
 * sign this is slow. SITE_URL is stripped from the env so the assertions don't
 * depend on the caller's setup.
 */

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { HTML_LANG, LANGS, translations } from "../src/translations.ts";
import { escapeHtml } from "../src/dom.ts";
import { pageTitle } from "../src/render.ts";
import { extractSocialTags, previewCard } from "./social-meta.ts";

const ROOT = `${import.meta.dir}/..`;

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
      // entirely rather than shipping a relative URL no scraper can resolve —
      // and the card degrades to `summary`, which needs none.
      const tags = await extractSocialTags(html);
      expect(tags.og.image).toBeUndefined();
      expect(tags.twitter.image).toBeUndefined();
      expect(tags.twitter.card).toBe("summary");
    }

    for (const extra of ["404.html", "robots.txt", "og-image.png"]) {
      expect(existsSync(`${ROOT}/dist/${extra}`)).toBe(true);
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
 * URLs — both workflows rebuild after `bun test`, so nothing deploys them.
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
  },
  120_000,
);
