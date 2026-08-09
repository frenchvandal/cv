/*
 * How dist/sitemap.xml looks to a person who opens it. Two stylesheets, both
 * named by [scripts/sitemap.ts](scripts/sitemap.ts) in `<?xml-stylesheet?>`
 * instructions, because one of them is dated:
 *
 *   sitemap.xsl  XSLT 1.0 (the only version browsers implement)—transforms
 *                the XML into a table with the URLs as links, the language of
 *                each page, and the date. What a browser renders today.
 *   sitemap.css  CSS applied to the XML tree as it stands. Much less: CSS
 *                cannot create a link, and no selector can read element text,
 *                so the URLs are inert and there is no language column. What a
 *                browser renders once XSLT is gone.
 *
 * Chrome removes XSLT in 158 (17 November 2026), with WebKit and Gecko agreed
 * to the same removal. Carrying both is not hedging: run Chrome with
 * `--disable-features=XSLT`—the state it ships in from 158—and it ignores
 * the XSL instruction and applies the CSS one, so the file degrades from the
 * table to the list on its own, on the day, with nothing to do. When that day
 * comes, delete the XSLT half; the CSS half is not deprecated and stays.
 *
 * Both are chrome, not content, so they borrow the site's palette but not its
 * fonts: the hashed `assets/noto-sans-*.woff2` names are only known to the
 * bundler, and a stylesheet that guessed at one would ship a 404. Same call, and
 * the same system stack, as the 404 page in [scripts/build.ts](scripts/build.ts).
 *
 * None of this reaches a machine. The instructions are not part of the
 * sitemaps.org 0.9 vocabulary; crawlers and `parseSitemap` read the same bytes
 * they always did.
 */

import { THEME_COLOR } from "../src/config.ts";
import { HTML_LANG, LANG_NAME, LANGS, PROFILE } from "../src/translations.ts";
// The names live with the file that references them, so the dependency runs
// one way: this module produces what sitemap.ts declares.
import { SITEMAP_NS } from "./sitemap.ts";

/**
 * One `<xsl:when>` per language, matching the folder a `<loc>` sits in.
 *
 * The site puts English at the root and every other language in its own
 * folder, so the language is a path segment—`/fr/`—and no longer the file
 * name. English is therefore not matched at all: it is the fallback, reached
 * when no other language's folder appears in the URL. Matching `/zh/` cannot
 * swallow `/zh-hant/`, since the trailing slash is part of the test.
 *
 * Order matters only in that English must come last, which it does by being
 * the `<xsl:otherwise>` rather than a `<xsl:when>`.
 */
const languageRows = LANGS.filter((lang) => lang !== "en").map((lang) => {
  const name = Bun.escapeHTML(LANG_NAME[lang]);
  const tag = Bun.escapeHTML(HTML_LANG[lang]);
  return `<xsl:when test="contains(s:loc, '/${lang}/')"><span lang="${tag}">${name}</span><code>${tag}</code></xsl:when>`;
}).join("\n                  ");

/** English is whatever carries no other language's folder. */
const englishRow = `<span lang="${Bun.escapeHTML(HTML_LANG.en)}">${
  Bun.escapeHTML(LANG_NAME.en)
}</span><code>${Bun.escapeHTML(HTML_LANG.en)}</code>`;

/**
 * The stylesheet, as a standalone XML document. Values are interpolated from
 * the same constants the site is built from; none of them contains a character
 * XML would read as markup, but they go through `Bun.escapeHTML` anyway—the
 * next endonym or name added might.
 */
export function sitemapXsl(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="s">
  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Sitemap — ${Bun.escapeHTML(PROFILE.fullName)}</title>
        <style>
          :root { color-scheme: light dark; }
          body { margin: 0; padding: 3rem 1.25rem;
                 font-family: system-ui, -apple-system, sans-serif;
                 font-size: 15px; line-height: 1.5;
                 background: ${THEME_COLOR.light}; color: #1d1d1f;
                 -webkit-font-smoothing: antialiased; }
          main { max-width: 52rem; margin: 0 auto; }
          h1 { font-size: 2rem; font-weight: 600; letter-spacing: -0.02em;
               margin: 0 0 0.5rem; }
          .lede, footer { color: #6e6e73; }
          .lede { margin: 0 0 2rem; }
          a { color: #0066cc; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .scroll { overflow-x: auto; }
          table { border-collapse: collapse; width: 100%;
                  font-variant-numeric: tabular-nums; }
          th, td { text-align: left; white-space: nowrap;
                   padding: 0.625rem 1.5rem 0.625rem 0;
                   border-bottom: 1px solid rgba(0, 0, 0, 0.12); }
          th { font-size: 0.8125rem; font-weight: 600; color: #6e6e73;
               text-transform: uppercase; letter-spacing: 0.04em; }
          td.num { color: #6e6e73; width: 1%; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                 font-size: 0.8125rem; color: #6e6e73; }
          td code { margin-left: 0.5rem; }
          footer { margin-top: 2rem; font-size: 0.8125rem; }
          @media (prefers-color-scheme: dark) {
            body { background: ${THEME_COLOR.dark}; color: #f5f5f7; }
            .lede, footer, th, td.num, code { color: #86868b; }
            a { color: #2997ff; }
            th, td { border-bottom-color: rgba(255, 255, 255, 0.16); }
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Sitemap</h1>
          <p class="lede">
            <xsl:value-of select="count(s:urlset/s:url)"/> URLs — the home, the
            CV, the writing index and every article, in each language the site
            publishes. This is sitemap.xml as a browser draws it; crawlers read
            the XML underneath, unchanged.
          </p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>URL</th>
                  <th>Language</th>
                  <th>Last modified</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="s:urlset/s:url">
                  <tr>
                    <td class="num"><xsl:value-of select="position()"/></td>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td>
                      <xsl:choose>
                        ${languageRows}
                        <xsl:otherwise>${englishRow}</xsl:otherwise>
                      </xsl:choose>
                    </td>
                    <td>
                      <xsl:choose>
                        <xsl:when test="s:lastmod">
                          <!-- The day is what a reader wants; the attribute
                               keeps the full W3C Datetime that was published. -->
                          <time datetime="{s:lastmod}">
                            <xsl:value-of select="substring(s:lastmod, 1, 10)"/>
                          </time>
                        </xsl:when>
                        <xsl:otherwise>—</xsl:otherwise>
                      </xsl:choose>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
          <footer>
            <a href="./">Back to the CV</a> · <a
              href="https://www.sitemaps.org/protocol.html">sitemaps.org 0.9</a>
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>

</xsl:stylesheet>
`;
}

/**
 * The fallback, styling the sitemap's own elements. `@namespace` is the whole
 * trick and the whole risk: `<loc>` is in the sitemaps.org namespace, so an
 * unprefixed `loc` selector matches nothing at all and the page renders as the
 * browser's bare XML tree.
 *
 * `<loc>` is deliberately not tinted like a link—CSS cannot make it one, and
 * blue text that does nothing when clicked is worse than plain text.
 */
export function sitemapCss(): string {
  return `@namespace url(${SITEMAP_NS});

/* The root element's background propagates to the canvas, so this fills the
   viewport even though the box is centred and capped. */
urlset {
  display: block;
  box-sizing: border-box;
  max-width: 52rem;
  margin: 0 auto;
  padding: 3rem 1.25rem;
  background: ${THEME_COLOR.light};
  color: #1d1d1f;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  counter-reset: entry;
}

urlset::before {
  content: 'Sitemap';
  display: block;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
}

url {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: baseline;
  padding: 0.625rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  counter-increment: entry;
}

url::before {
  content: counter(entry);
  color: #6e6e73;
  font-variant-numeric: tabular-nums;
}

loc {
  overflow-wrap: anywhere;
}

/* Absent whenever git could not date the content, which is a two-column row. */
lastmod {
  color: #6e6e73;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  urlset {
    background: ${THEME_COLOR.dark};
    color: #f5f5f7;
  }

  url {
    border-bottom-color: rgba(255, 255, 255, 0.16);
  }

  url::before,
  lastmod {
    color: #86868b;
  }
}
`;
}

if (import.meta.main) {
  console.log(Bun.argv[2] === "css" ? sitemapCss() : sitemapXsl());
}
