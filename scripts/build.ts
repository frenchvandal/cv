/*
 * Static site generator (run by Bun: `bun scripts/build.ts`).
 *
 * 1. Bun.build bundles the HTML entry → JS/CSS/font assets with hashed names.
 * 2. For each of the four languages we take the built shell, inject the
 *    pre-rendered markup (the same pure `renderApp` the client uses) plus
 *    per-language <head> meta and the @font-face rules (so fonts load before
 *    any JS, and no-JS visitors get them too), and write sibling pages at the
 *    site root: index.html, fr.html, zh.html, zh-hant.html.
 *
 * The pages are siblings (same depth) so every asset path stays relative
 * (`./assets/…`) and the whole `dist/` uploads to any host/bucket path
 * unchanged. Set SITE_URL=https://example.com to emit absolute canonical /
 * hreflang URLs and a sitemap — search engines require absolute URLs there,
 * so the GitHub Actions workflow sets it from the Pages base URL.
 */

import { readdir, rm } from "node:fs/promises";
import { langUrl, pageTitle, renderApp } from "../src/render.ts";
// The same escaper the renderer uses — one implementation, so the two can't
// drift (this file used to carry a near-copy that missed the apostrophe).
import { escapeHtml } from "../src/dom.ts";
import { FONT_FACES, fontFaceCss } from "../src/fonts.ts";
import { THEME_COLOR } from "../src/config.ts";
import {
  HTML_LANG,
  type Lang,
  LANGS,
  PROFILE,
  SAME_AS,
  translations,
} from "../src/translations.ts";

const OUT = "dist";

/**
 * SITE_URL, validated and normalized (origin + path, no trailing slash). A
 * malformed value would silently bake broken canonical/og/sitemap URLs into
 * every page, so reject it at build time instead.
 */
function siteBase(): string {
  const raw = process.env.SITE_URL;
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`SITE_URL is not an absolute URL: ${JSON.stringify(raw)}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`SITE_URL must be http(s): ${JSON.stringify(raw)}`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

const SITE = siteBase();

/** Open Graph wants underscore locales, not BCP-47 tags. */
const OG_LOCALE: Record<Lang, string> = {
  en: "en_US",
  fr: "fr_FR",
  zh: "zh_CN",
  "zh-hant": "zh_TW",
};

/** Public URL of a language's page — relative by default, absolute when SITE_URL is set. */
function href(lang: Lang): string {
  if (!SITE) return langUrl(lang);
  return lang === "en" ? `${SITE}/` : `${SITE}/${lang}.html`;
}

function outFile(lang: Lang): string {
  return lang === "en" ? `${OUT}/index.html` : `${OUT}/${lang}.html`;
}

// The typecheck gates the build but shares no data with it, so it runs
// concurrently with the bundle; its exit code is awaited at the end.
const typecheck = Bun.spawn(["./node_modules/.bin/tsgo", "--noEmit"], {
  stdout: "inherit",
  stderr: "inherit",
});

await rm(OUT, { recursive: true, force: true });

// Throws an AggregateError carrying the logs if the bundle fails.
await Bun.build({
  entrypoints: ["./index.html"],
  outdir: OUT,
  minify: true,
  sourcemap: "linked",
  publicPath: "./",
  // Dynamic imports (the per-language hyphenation patterns) become their own
  // chunks: a visitor only downloads the patterns of the language they read.
  splitting: true,
  // Everything but the HTML pages lives under assets/, content-hashed, so
  // far-future caching stays safe and deploys invalidate cleanly.
  naming: {
    chunk: "assets/[name]-[hash].[ext]",
    asset: "assets/[name]-[hash].[ext]",
  },
  // `feature("PROD")` (bun:bundle) compiles to `true` here: dev-only paths
  // guarded by `!feature("PROD")` are dead-code-eliminated from the bundle.
  features: ["PROD"],
});

/*
 * @font-face for the pre-rendered pages. FONT_FACES from src/fonts.ts carries
 * the families and unicode ranges; the URLs there are runtime file paths, so we
 * remap each source basename to its emitted hashed asset in dist/assets.
 */
const fontAssets = (await readdir(`${OUT}/assets`)).filter((name) =>
  name.endsWith(".woff2")
);

function distFontUrl(sourceUrl: string): string {
  const base = sourceUrl.split("/").pop()!.replace(/\.woff2$/, "");
  const match = fontAssets.find((name) => name.startsWith(`${base}-`));
  if (!match) throw new Error(`No emitted asset found for font "${base}"`);
  return `./assets/${match}`;
}

const distFontFaces = FONT_FACES.map((face) => ({
  ...face,
  url: distFontUrl(face.url),
}));
const fontsStyle = `<style data-fonts="ssg">${
  fontFaceCss(distFontFaces)
}</style>`;
// Only the Latin subset is preloaded: every page needs it, while the CJK
// subsets stay lazy behind their unicode-range.
const latinFace = distFontFaces.find((face) => face.family === "Noto Sans")!;
const fontPreload = `<link rel="preload" href="${
  escapeHtml(latinFace.url)
}" as="font" type="font/woff2" crossorigin />`;

/*
 * Social preview image. Not referenced by the bundle (it only appears in meta
 * tags), so it is copied by hand — unhashed, because scrapers cache by URL and
 * the tags need a stable name. Scrapers also require an absolute URL, so the
 * og:image/twitter tags are SITE_URL-gated like the sitemap.
 */
const OG_IMAGE = "og-image.png";
await Bun.write(`${OUT}/${OG_IMAGE}`, Bun.file(`public/${OG_IMAGE}`));

const shell = await Bun.file(`${OUT}/index.html`).text();

for (const lang of LANGS) {
  const t = translations[lang];
  const title = pageTitle(t);
  const description = t.meta.description;
  // Light is the no-JS default (see src/styles.css); the inline <head> script
  // switches to dark before first paint when the visitor or the OS asks.
  const content = renderApp(lang, "light");

  const alternates = LANGS.map(
    (l) =>
      `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${
        escapeHtml(href(l))
      }" />`,
  ).join("\n    ");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: PROFILE.fullName,
    alternateName: PROFILE.chineseName,
    jobTitle: t.hero.title,
    url: href(lang),
    sameAs: SAME_AS,
    address: {
      "@type": "PostalAddress",
      addressLocality: PROFILE.address.locality,
      addressCountry: PROFILE.address.country,
    },
    knowsLanguage: PROFILE.knowsLanguage,
  }).replace(/</g, "\\u003C");

  const headExtra = `
    ${fontPreload}
    ${fontsStyle}
    <link rel="canonical" href="${escapeHtml(href(lang))}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${
    escapeHtml(href("en"))
  }" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(href(lang))}" />
    <meta property="og:locale" content="${OG_LOCALE[lang]}" />${
    SITE
      ? `
    <meta property="og:image" content="${escapeHtml(`${SITE}/${OG_IMAGE}`)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${
        escapeHtml(`${SITE}/${OG_IMAGE}`)
      }" />`
      : `
    <meta name="twitter:card" content="summary" />`
  }
    <script type="application/ld+json">${jsonLd}</script>`;

  const html = await new HTMLRewriter()
    .on("html", {
      element(el) {
        el.setAttribute("lang", HTML_LANG[lang]);
        el.setAttribute("data-lang", lang);
      },
    })
    .on("title", { element: (el) => void el.setInnerContent(title) })
    .on('meta[name="description"]', {
      element: (el) => void el.setAttribute("content", description),
    })
    .on("style[data-loader]", { element: (el) => void el.remove() })
    .on("head", { element: (el) => void el.append(headExtra, { html: true }) })
    .on("#app", {
      element: (el) => void el.setInnerContent(content, { html: true }),
    })
    .transform(new Response(shell))
    .text();

  await Bun.write(outFile(lang), html);
  console.log(`  ${outFile(lang)}  (${lang})`);
}

// Robots + sitemap (the sitemap needs absolute URLs, so it is SITE_URL-gated).
const robots = [
  "User-agent: *",
  "Allow: /",
  ...(SITE ? [`Sitemap: ${SITE}/sitemap.xml`] : []),
  "",
];
await Bun.write(`${OUT}/robots.txt`, robots.join("\n"));
console.log(`  ${OUT}/robots.txt`);

if (SITE) {
  const urls = LANGS.map(
    (lang) => `  <url>\n    <loc>${escapeHtml(href(lang))}</loc>\n  </url>`,
  ).join("\n");
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await Bun.write(`${OUT}/sitemap.xml`, sitemap);
  console.log(`  ${OUT}/sitemap.xml`);
}

// Friendly 404 for GitHub Pages (served for any unknown path).
const notFound = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>404 — ${escapeHtml(PROFILE.fullName)}</title>
    <style>
      :root { color-scheme: light dark; }
      body { font-family: system-ui, -apple-system, sans-serif;
             background: ${THEME_COLOR.light}; color: #1d1d1f;
             display: grid; place-items: center; min-height: 100vh; margin: 0;
             -webkit-font-smoothing: antialiased; }
      main { text-align: center; }
      h1 { font-size: 3rem; font-weight: 600; letter-spacing: -0.02em; }
      a { color: #0066cc; text-decoration: none; }
      a:hover { text-decoration: underline; }
      @media (prefers-color-scheme: dark) {
        body { background: ${THEME_COLOR.dark}; color: #f5f5f7; }
        a { color: #2997ff; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>This page does not exist. <a href="./">Back to the CV</a>.</p>
    </main>
  </body>
</html>
`;
await Bun.write(`${OUT}/404.html`, notFound);
console.log(`  ${OUT}/404.html`);

if ((await typecheck.exited) !== 0) {
  console.error(
    "\n✗ Typecheck failed — dist/ was written, but the build is rejected.",
  );
  process.exit(1);
}

console.log(
  `\n✓ Pre-rendered ${LANGS.length} pages into ${OUT}/${
    SITE ? "" : " (relative URLs — set SITE_URL for canonical/hreflang/sitemap)"
  }`,
);
