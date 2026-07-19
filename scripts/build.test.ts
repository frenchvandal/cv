/*
 * Build smoke test: run the real SSG (scripts/build.ts) and assert the emitted
 * dist/ pages carry their pre-rendered content, SEO head tags and font rules —
 * the contract deploys rely on. Heavy (a full bundle + four pre-renders), hence
 * the explicit timeout. SITE_URL is stripped from the env so the assertions
 * don't depend on the caller's setup.
 */

import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { HTML_LANG, LANGS } from "../src/translations.ts";

const ROOT = `${import.meta.dir}/..`;

test(
  "bun scripts/build.ts emits four complete, well-formed pages",
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
      const file = lang === "en" ? "index.html" : `${lang}.html`;
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
    }

    for (const extra of ["404.html", "robots.txt", "og-image.png"]) {
      expect(existsSync(`${ROOT}/dist/${extra}`)).toBe(true);
    }
  },
  120_000,
);
