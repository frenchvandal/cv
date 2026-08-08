/*
 * Static site generator (run by Bun: `bun scripts/build.ts`).
 *
 * 1. Bun.build bundles the HTML entry → JS/CSS/font assets with hashed names.
 * 2. The corpus is loaded from content/posts/ (scripts/content.ts).
 * 3. For each of the seven languages we take the built shell, inject the
 *    pre-rendered markup (the same pure `renderPage` the client uses) plus
 *    per-language <head> meta and the @font-face rules, and write one file per
 *    page: home, CV and blog index for every language, then one page per
 *    article that exists in it. English sits at the root, every other
 *    language in its folder—so asset paths are computed from each page's
 *    depth (`rel(depth)` in src/urls.ts).
 *
 * All paths stay relative, so the whole `dist/` uploads to any host/bucket
 * path unchanged. Set SITE_URL=https://example.com to emit absolute canonical
 * / hreflang URLs, feeds and a sitemap—search engines require absolute URLs
 * there, so the GitHub Actions workflow sets it from the Pages base URL.
 */

import { readdir, rm } from "node:fs/promises";
import {
  languageNegotiationScript,
  type Page,
  pageRefOf,
  renderPage,
} from "../src/render.ts";
// The per-language <head>, shared with the runtime so a reload-free language
// switch rewrites exactly what this file bakes in.
import { pageMeta } from "../src/meta.ts";
// The same escaper the renderer uses—one implementation, so the two can't
// drift (this file used to carry a near-copy that missed the apostrophe).
import { escapeHtml } from "../src/dom.ts";
import {
  contentLastmod,
  postLastmod,
  SITEMAP_CSS_FILE,
  SITEMAP_XSL_FILE,
  sitemapXml,
} from "./sitemap.ts";
import { sitemapCss, sitemapXsl } from "./sitemap-style.ts";
import { FEED_MIME, feedFile, feedJson, jsonFeed } from "./feed.ts";
import { loadPosts } from "./content.ts";
import { relayHtml, relayPages, relayTarget } from "./relay.ts";
import { byLang, langsOf } from "../src/post.ts";
import { pageDepth, pagePath, type PageRef, rel } from "../src/urls.ts";
import { FONT_FACES, fontFaceCss } from "../src/fonts.ts";
import { THEME_COLOR } from "../src/config.ts";
import {
  HTML_LANG,
  type Lang,
  LANGS,
  PROFILE,
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

const posts = await loadPosts();

/**
 * Public URL of a page—relative by default, absolute when SITE_URL is set.
 * Directory URLs for indexes (`fr/` is the French home), file URLs for
 * articles.
 */
function pageUrl(ref: PageRef): string {
  const path = pagePath(ref).replace(/(^|\/)index\.html$/, "$1");
  return SITE ? `${SITE}/${path}` : `./${path}`;
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
  // No publicPath: it is not needed (the emitted HTML already references
  // `./assets/…`, and chunks import each other by bare sibling name), and
  // `"./"` actively breaks the sourcemaps—Bun prefixes it to the full output
  // path, emitting `sourceMappingURL=./assets/index-….js.map` inside a file
  // that already lives in assets/. Browsers resolve that against the script's
  // own URL, ask for /assets/assets/… and log a 404 for every chunk.
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
 * the families and unicode ranges; the URLs there are runtime file paths, so
 * each source basename is remapped to its emitted hashed asset in
 * dist/assets—and then prefixed for the depth of the page being written, since
 * every URL stays relative.
 */
const assets = await readdir(`${OUT}/assets`);
const fontAssets = assets.filter((name) => name.endsWith(".woff2"));

/** The emitted (hashed) file name of a source font, or a build error. */
function fontAssetName(sourceUrl: string): string {
  const base = sourceUrl.split("/").pop()!.replace(/\.woff2$/, "");
  const match = fontAssets.find((name) => name.startsWith(`${base}-`));
  if (!match) throw new Error(`No emitted asset found for font "${base}"`);
  return match;
}

/*
 * The font rules and preload of one page, at its depth. Only the Latin subset
 * is preloaded: every page needs it, while the CJK subsets stay lazy behind
 * their unicode-range.
 */
function fontHead(prefix: string): { preload: string; style: string } {
  const faces = FONT_FACES.map((face) => ({
    ...face,
    url: `${prefix}assets/${fontAssetName(face.url)}`,
  }));
  const latin = faces.find((face) => face.family === "Noto Sans");
  if (!latin) throw new Error('No emitted asset for the "Noto Sans" face');
  return {
    preload: `<link rel="preload" href="${
      escapeHtml(latin.url)
    }" as="font" type="font/woff2" crossorigin />`,
    style: `<style data-fonts="ssg">${fontFaceCss(faces)}</style>`,
  };
}

/*
 * Social preview image. Not referenced by the bundle (it only appears in meta
 * tags), so it is copied by hand—unhashed, because scrapers cache by URL and
 * the tags need a stable name. Scrapers also require an absolute URL, so the
 * og:image/twitter tags are SITE_URL-gated like the sitemap.
 */
const OG_IMAGE = "og-image.png";
await Bun.write(`${OUT}/${OG_IMAGE}`, Bun.file(`public/${OG_IMAGE}`));

const shell = await Bun.file(`${OUT}/index.html`).text();

const faviconAsset = assets.find((name) => name.startsWith("favicon-"));

/** Home, CV and blog index for one language, then one page per article it has. */
function pagesFor(lang: Lang): { ref: PageRef; page: Page }[] {
  return [
    { ref: { kind: "home", lang }, page: { kind: "home", posts } },
    { ref: { kind: "cv", lang }, page: { kind: "cv" } },
    { ref: { kind: "blogIndex", lang }, page: { kind: "blogIndex", posts } },
    ...byLang(posts, lang).map((meta) => ({
      ref: { kind: "post" as const, lang, slug: meta.slug },
      page: {
        kind: "post" as const,
        post: meta,
        // byLang types the corpus as PostMeta; the body comes from the Post.
        html: posts.find((p) => p.slug === meta.slug && p.lang === lang)!.html,
        posts,
      },
    })),
  ];
}

for (const lang of LANGS) {
  const t = translations[lang];

  for (const { ref, page } of pagesFor(lang)) {
    const prefix = rel(pageDepth(ref));
    // Everything language-dependent in the <head>, from the module the runtime
    // rewrites it with ([src/meta.ts](src/meta.ts)): a value defined here instead
    // would be one a reload-free language switch silently leaves behind. An
    // article carries its own title and summary instead of the CV's.
    const meta = pageMeta(
      lang,
      pageUrl(ref),
      page.kind === "post"
        ? {
          title: `${page.post.title} — ${t.name.display}`,
          description: page.post.summary,
        }
        : undefined,
    );
    const { title, description } = meta;
    // Light is the no-JS default (see src/styles.css); the inline <head> script
    // switches to dark before first paint when the visitor or the OS asks.
    const content = renderPage(page, lang, "light");

    // hreflang covers the languages the page exists in: all seven for home,
    // CV and index; only the written ones for an article (its zh-hk
    // projection included—loadPosts already derived it).
    const alternateLangs = page.kind === "post"
      ? langsOf(posts, page.post.slug)
      : [...LANGS];
    const alternates = alternateLangs.map((l) =>
      `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${
        escapeHtml(pageUrl(pageRefOf(page, l)))
      }" />`
    ).join("\n    ");
    // x-default is the English same-kind page, or the English index when the
    // article was never written in English.
    const xDefault = page.kind === "post" && !alternateLangs.includes("en")
      ? pageUrl({ kind: "blogIndex", lang: "en" })
      : pageUrl(pageRefOf(page, "en"));

    // The negotiation script goes first so a redirect is not preceded by a font
    // preload we are about to abandon. Only the site root negotiates: a URL
    // naming a language must always be honoured.
    const { preload: fontPreload, style: fontsStyle } = fontHead(prefix);
    const head = `
    ${ref.kind === "home" && lang === "en" ? languageNegotiationScript() : ""}
    ${fontPreload}
    ${fontsStyle}
    <link rel="canonical" href="${escapeHtml(meta.url)}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${
      escapeHtml(xDefault)
    }" />${
      SITE
        ? `
    <link rel="alternate" type="${FEED_MIME}" title="${
          escapeHtml(title)
        }" href="${escapeHtml(`${SITE}/${feedFile(lang)}`)}" />`
        : ""
    }
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:locale" content="${meta.ogLocale}" />${
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
    <script type="application/ld+json">${meta.jsonLd}</script>`;

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
      // The bundled shell references "./assets/…"; a page deeper than the root
      // needs "../…". Rewritten here rather than with a <base>, which would
      // break the relative links between pages. The injected <head> below is
      // not re-scanned by this pass—its URLs are built with the prefix already.
      .on("script[src], link[href]", {
        element(el) {
          for (const attr of ["src", "href"] as const) {
            const value = el.getAttribute(attr);
            if (value?.startsWith("./assets/")) {
              el.setAttribute(attr, prefix + value.slice(2));
            }
          }
        },
      })
      .on("style[data-loader]", { element: (el) => void el.remove() })
      .on("head", { element: (el) => void el.append(head, { html: true }) })
      .on("#app", {
        element: (el) => void el.setInnerContent(content, { html: true }),
      })
      .transform(new Response(shell))
      .text();

    const file = `${OUT}/${pagePath(ref)}`;
    await Bun.write(file, html);
    console.log(`  ${file}  (${lang})`);
  }

  // JSON Feed, gated on SITE_URL like the sitemap—`feed_url` is the feed's own
  // identifier, and item ids are page URLs, so neither means anything relative.
  if (SITE) {
    const file = `${OUT}/${feedFile(lang)}`;
    await Bun.write(
      file,
      feedJson(jsonFeed({
        lang,
        t,
        posts,
        homePageUrl: pageUrl({ kind: "home", lang }),
        feedUrl: `${SITE}/${feedFile(lang)}`,
        ...(faviconAsset ? { favicon: `${SITE}/assets/${faviconAsset}` } : {}),
        postUrl: (post) =>
          `${SITE}/${
            pagePath({ kind: "post", lang: post.lang, slug: post.slug })
          }`,
      })),
    );
    console.log(`  ${file}  (${lang})`);
  }
}

// Relay pages for the pre-blog URLs (`fr.html` → `fr/`, `en.html` → the root),
// written after the real pages: nothing here may shadow one.
for (const { file, target } of relayPages()) {
  await Bun.write(
    `${OUT}/${file}`,
    relayHtml(relayTarget(target), PROFILE.fullName),
  );
  console.log(`  ${OUT}/${file}  (relay)`);
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
  // Home, CV and blog index for every language, then every article. The relay
  // pages are noindex and never listed; 404.html is noindex either.
  const lastmod = await contentLastmod();
  if (!lastmod) {
    console.warn(
      "  ! git could not date the content — <lastmod> omitted (shallow clone?)",
    );
  }
  const fixed = LANGS.flatMap((lang) =>
    (["home", "cv", "blogIndex"] as const).map((kind) => ({
      loc: pageUrl({ kind, lang }),
      ...(lastmod ? { lastmod } : {}),
    }))
  );
  // An article is dated by its own source file; editing one post must not
  // redate them all. A git-less checkout falls back to the content date, then
  // to no field at all—never to a synthesized one.
  const articles = await Promise.all(
    posts.map(async (post) => {
      const modified = (await postLastmod(post.sourcePath)) ?? lastmod;
      return {
        loc: pageUrl({ kind: "post", lang: post.lang, slug: post.slug }),
        ...(modified ? { lastmod: modified } : {}),
      };
    }),
  );
  await Bun.write(
    `${OUT}/sitemap.xml`,
    sitemapXml(SITE, [...fixed, ...articles]),
  );
  console.log(`  ${OUT}/sitemap.xml`);
  // The sitemap points at both by relative name, so the three ship together or
  // not at all—a dangling stylesheet reference is a console error on a file
  // whose whole job is to be machine-read without incident.
  await Bun.write(`${OUT}/${SITEMAP_XSL_FILE}`, sitemapXsl());
  console.log(`  ${OUT}/${SITEMAP_XSL_FILE}`);
  await Bun.write(`${OUT}/${SITEMAP_CSS_FILE}`, sitemapCss());
  console.log(`  ${OUT}/${SITEMAP_CSS_FILE}`);
}

// Friendly 404 for GitHub Pages, served for any unknown path—including
// nested ones (/foo/bar), where a relative "./" would resolve to the still-
// missing directory and 404 again. pageUrl is absolute whenever SITE_URL is
// set (every real deploy); the relative fallback only matters for local dist/
// previews, which are served from the site root anyway.
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
      <p>This page does not exist. <a href="${
  escapeHtml(pageUrl({ kind: "home", lang: "en" }))
}">Back to the site</a>.</p>
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
  `\n✓ Pre-rendered ${LANGS.length * 3 + posts.length} pages into ${OUT}/${
    SITE ? "" : " (relative URLs — set SITE_URL for canonical/hreflang/sitemap)"
  }`,
);
