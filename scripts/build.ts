/*
 * Static site generator (run by Bun: `bun scripts/build.ts`).
 *
 * 1. Bun.build bundles the HTML entry → JS/CSS/font assets with hashed names.
 * 2. Articles are read off the disk ([scripts/content.ts](scripts/content.ts)).
 * 3. For each language we take the built shell and write one file per page —
 *    home, CV, blog index, and one per article that language has — injecting
 *    the pre-rendered markup (the same pure `renderPage` the client uses) plus
 *    the page’s own <head> meta and the @font-face rules, so fonts load before
 *    any JS and no-JS visitors get them too.
 *
 * English sits at the site root and every other language in its own folder, so
 * page depth is no longer uniform: every asset URL is prefixed with `rel(depth)`
 * ([src/urls.ts](src/urls.ts)) rather than a bare `./`. The paths stay relative,
 * which is what lets the whole `dist/` upload to any host or bucket prefix
 * unchanged. Set SITE_URL=https://example.com to emit absolute canonical /
 * hreflang URLs and a sitemap — search engines require absolute URLs there.
 */

import { readdir, rm } from "node:fs/promises";
import {
  languageNegotiationScript,
  type Page,
  renderPage,
} from "../src/render.ts";
// The per-page <head>, shared with the runtime so a reload-free language
// switch rewrites exactly what this file bakes in.
import { pageMeta } from "../src/meta.ts";
// The same escaper the renderer uses—one implementation, so the two can’t
// drift (this file used to carry a near-copy that missed the apostrophe).
import { escapeHtml } from "../src/dom.ts";
import { byLang, langsOf } from "../src/post.ts";
import { pageDepth, pagePath, type PageRef, rel } from "../src/urls.ts";
import { loadPosts } from "./content.ts";
import { relayHtml, relayPages, relayTarget } from "./relay.ts";
import {
  contentLastmod,
  postLastmod,
  SITEMAP_CSS_FILE,
  sitemapXml,
} from "./sitemap.ts";
import { sitemapCss } from "./sitemap-style.ts";
import { FEED_MIME, feedFile, feedJson, jsonFeed } from "./feed.ts";
import { FONT_FACES, fontFaceCss } from "../src/fonts.ts";
import { missingGlyphs } from "./glyphs.ts";
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

/*
 * The subsets must cover what the pages can draw, checked on every build.
 *
 * A missing glyph is the one defect this project cannot notice on its own: it
 * does not throw, it does not fail a test, it falls back to a system font in
 * the middle of a line and ships. The check is offline and cheap — it compares
 * the corpus against the unicode-ranges already on disk — which is why it runs
 * here rather than only in `bun test`.
 *
 * Refetching the subsets from Google at build time would be the wrong cure:
 * it would put a network call on the critical path of every CI run and make
 * two builds of the same commit produce different bytes. The build verifies;
 * `bun run fonts:update` is what refreshes.
 */
const shortfall = await missingGlyphs(FONT_FACES);
if (shortfall.length > 0) {
  for (const { family, missing } of shortfall) {
    console.error(
      `✗ ${family}: ${missing.length} glyph(s) not covered — ${
        missing.slice(0, 12).join(" ")
      }${missing.length > 12 ? " …" : ""}`,
    );
  }
  console.error("\n  Run `bun run fonts:update`, then rebuild.");
  process.exit(1);
}

/**
 * A page’s public URL. Indexes are published as directory URLs (`fr/` is the
 * French home) so the canonical never carries a file name a reader would have
 * to type; articles keep theirs.
 */
function pageUrl(ref: PageRef): string {
  const path = pagePath(ref).replace(/(^|\/)index\.html$/, "$1");
  return SITE ? `${SITE}/${path}` : `./${path}`;
}

/** The same page in another language, for the alternates and x-default. */
function refIn(ref: PageRef, lang: Lang): PageRef {
  return ref.kind === "post" ? { ...ref, lang } : { kind: ref.kind, lang };
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
  // that already lives in assets/. Browsers resolve that against the script’s
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
 * each source basename is remapped to its emitted hashed asset — and then
 * prefixed for the depth of the page being written, since every URL here stays
 * relative.
 */
const assets = await readdir(`${OUT}/assets`);
const fontAssets = assets.filter((name) => name.endsWith(".woff2"));

function fontAssetName(sourceUrl: string): string {
  const base = sourceUrl.split("/").pop()!.replace(/\.woff2$/, "");
  const match = fontAssets.find((name) => name.startsWith(`${base}-`));
  if (!match) throw new Error(`No emitted asset found for font "${base}"`);
  return match;
}

/*
 * Only the Latin subset is preloaded: every page needs it, while the CJK
 * subsets stay lazy behind their unicode-range.
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
    ...byLang(posts, lang).map((post) => ({
      ref: { kind: "post" as const, lang, slug: post.slug },
      page: {
        kind: "post" as const,
        post,
        html: post.html,
        posts,
      },
    })),
  ];
}

/** The first sentence of a text, as a description a search result can show. */
function firstSentence(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("。"));
  return stop > max / 3 ? clean.slice(0, stop + 1).trim() : `${head.trim()}…`;
}

/**
 * What a page says about itself in the `<head>`.
 *
 * Every page used to carry the CV’s title and description — the site name for
 * the home, the CV and the writing index alike, in all seven languages. Three
 * different pages announcing themselves identically is a duplicate title in a
 * search result and, worse, a writing index that presents itself as a CV.
 *
 * The home keeps the site’s own title, because it IS the front door. The other
 * three name themselves, and each takes a description from content it already
 * owns rather than from a new translation string: the CV opens with `about.p1`,
 * the index with its own intro, an article with its summary.
 */
function metaFor(
  page: Page,
  t: (typeof translations)[Lang],
): { title: string; description: string } | undefined {
  switch (page.kind) {
    case "home":
      return undefined;
    case "cv":
      return {
        title: `${t.nav.cv} — ${t.name.display}`,
        description: firstSentence(t.about.p1),
      };
    case "blogIndex":
      return {
        title: `${t.nav.writing} — ${t.name.display}`,
        description: t.blog.indexIntro,
      };
    case "post":
      return {
        title: `${page.post.title} — ${t.name.display}`,
        description: page.post.summary,
      };
  }
}

const written: PageRef[] = [];

for (const lang of LANGS) {
  const t = translations[lang];

  for (const { ref, page } of pagesFor(lang)) {
    const prefix = rel(pageDepth(ref));
    const meta = pageMeta(lang, pageUrl(ref), metaFor(page, t));
    const { title, description } = meta;
    // Light is the no-JS default (see src/styles.css); the inline <head> script
    // switches to dark before first paint when the visitor or the OS asks.
    const content = renderPage(page, lang, "light");

    // hreflang covers the languages the page actually exists in: all seven for
    // home, CV and index; only the written ones for an article (its zh-hk
    // projection included—loadPosts already derived it).
    const alternateLangs = page.kind === "post"
      ? langsOf(posts, page.post.slug)
      : [...LANGS];
    const alternates = alternateLangs.map((l) =>
      `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${
        escapeHtml(pageUrl(refIn(ref, l)))
      }" />`
    ).join("\n    ");
    // x-default is the English page of the same kind, or the English index
    // when the article was never written in English.
    const xDefault = page.kind === "post" && !alternateLangs.includes("en")
      ? pageUrl({ kind: "blogIndex", lang: "en" })
      : pageUrl(refIn(ref, "en"));

    // The negotiation script goes first so a redirect is not preceded by a font
    // preload we are about to abandon. Only the site root negotiates: a URL
    // naming a language must always be honoured.
    const { preload: fontPreload, style: fontsStyle } = fontHead(prefix);
    const negotiates = ref.kind === "home" && lang === "en";
    const head = `
    ${negotiates ? languageNegotiationScript() : ""}
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
    <meta property="og:type" content="${
      page.kind === "post" ? "article" : "website"
    }" />
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
      // break the relative links between pages. The <head> injected below is
      // not re-scanned by this pass—its URLs already carry the prefix.
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
    written.push(ref);
    console.log(`  ${file}  (${lang})`);
  }

  // JSON Feed. Gated on SITE_URL like the sitemap—`feed_url` is the feed’s own
  // identifier, and item ids are built from the page URL, so neither means
  // anything relative.
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
          pageUrl({ kind: "post", lang: post.lang, slug: post.slug }),
      })),
    );
    console.log(`  ${file}  (${lang})`);
  }
}

/*
 * Relay pages for the URLs the flat layout used to serve (`fr.html` → `fr/`,
 * `en.html` → the root). Written after the real pages, so nothing here can
 * shadow one — `relayPages` deliberately leaves the root out.
 */
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
  // Every page that was actually written, in the order it was written.
  // 404.html is noindex and stays out.
  const lastmod = await contentLastmod();
  if (!lastmod) {
    console.warn(
      "  ! git could not date the content — <lastmod> omitted (shallow clone?)",
    );
  }
  /*
   * An article is dated from its own source file: it changes on its own
   * schedule, and borrowing the site-wide date would claim every article was
   * modified whenever anything else was. The fixed pages keep that site-wide
   * date, which is what actually governs them.
   *
   * The lookups are one per article file and independent, so they run together
   * rather than one after the other.
   */
  const postDates = new Map(
    await Promise.all(
      posts.map(async (post) =>
        [
          `${post.slug}/${post.lang}`,
          await postLastmod(post.sourcePath),
        ] as const
      ),
    ),
  );
  const entries = written.map((ref) => {
    const date = ref.kind === "post"
      ? postDates.get(`${ref.slug}/${ref.lang}`)
      : lastmod;
    return {
      loc: pageUrl(ref),
      ...(date ? { lastmod: date } : {}),
    };
  });
  await Bun.write(`${OUT}/sitemap.xml`, sitemapXml(SITE, entries));
  console.log(`  ${OUT}/sitemap.xml`);
  // The sitemap points at it by relative name, so the two ship together or not
  // at all—a dangling stylesheet reference is a console error on a file whose
  // whole job is to be machine-read without incident.
  await Bun.write(`${OUT}/${SITEMAP_CSS_FILE}`, sitemapCss());
  console.log(`  ${OUT}/${SITEMAP_CSS_FILE}`);
}

// Friendly 404, served for any unknown path—including nested ones (/foo/bar),
// where a relative "./" would resolve to the still-missing directory and 404
// again. The English home is absolute whenever SITE_URL is set (every real
// deploy); the relative fallback only matters for local dist/ previews, which
// are served from the site root anyway.
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
  `\n✓ Pre-rendered ${written.length} pages (${posts.length} article files) into ${OUT}/${
    SITE ? "" : " (relative URLs — set SITE_URL for canonical/hreflang/sitemap)"
  }`,
);
