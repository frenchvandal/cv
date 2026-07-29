/*
 * sitemap.xsl — the stylesheet a browser applies to dist/sitemap.xml.
 *
 * A sitemap is written for crawlers, but its URL is public and people do open
 * it. `<?xml-stylesheet?>` (emitted by [scripts/sitemap.ts](scripts/sitemap.ts))
 * makes the browser transform the XML into the table below before painting it,
 * while every machine that matters — the crawlers, and `parseSitemap` — reads
 * the same bytes it always did: the processing instruction is not part of the
 * sitemaps.org 0.9 vocabulary and nothing in the protocol parses it.
 *
 * XSLT **1.0**, because that is the only version any browser implements, and
 * with a shelf life: Chrome removes XSLT entirely in 158 (17 November 2026),
 * with WebKit and Gecko having agreed to the same removal. Nothing breaks on
 * that date — an unresolvable stylesheet leaves the browser showing the raw XML,
 * which is what it showed before this file existed — so the right move then is
 * to delete this module and the PI, not to work around the removal.
 *
 * The page is chrome, not content, so it borrows the site's palette but not its
 * fonts: the hashed `assets/noto-sans-*.woff2` names are only known to the
 * bundler, and a stylesheet that guessed at one would ship a 404. Same call, and
 * the same system stack, as the 404 page in [scripts/build.ts](scripts/build.ts).
 */

import { THEME_COLOR } from "../src/config.ts";
import { langUrl } from "../src/render.ts";
import { HTML_LANG, LANG_NAME, LANGS, PROFILE } from "../src/translations.ts";

/** Written next to sitemap.xml, which points at it by this relative name. */
export const SITEMAP_XSL_FILE = "sitemap.xsl";

/**
 * One `<xsl:when>` per language, matching the last segment of a `<loc>` — `""`
 * for English, which is the site root. Generated from `langUrl`, the same
 * function the pages and the sitemap take their URLs from, so a language cannot
 * be added to the site and be missing from this column.
 */
const languageRows = LANGS.map((lang) => {
  const file = langUrl(lang).replace(/^\.\//, "");
  const name = Bun.escapeHTML(LANG_NAME[lang]);
  const tag = Bun.escapeHTML(HTML_LANG[lang]);
  return `<xsl:when test="$file = '${file}'"><span lang="${tag}">${name}</span><code>${tag}</code></xsl:when>`;
}).join("\n                  ");

/**
 * The stylesheet, as a standalone XML document. Values are interpolated from
 * the same constants the site is built from; none of them contains a character
 * XML would read as markup, but they go through `Bun.escapeHTML` anyway — the
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
            <xsl:value-of select="count(s:urlset/s:url)"/> URLs — one CV, one
            page per language. This is sitemap.xml as a browser draws it;
            crawlers read the XML underneath, unchanged.
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
                  <xsl:variable name="file">
                    <xsl:call-template name="basename">
                      <xsl:with-param name="path" select="s:loc"/>
                    </xsl:call-template>
                  </xsl:variable>
                  <tr>
                    <td class="num"><xsl:value-of select="position()"/></td>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td>
                      <xsl:choose>
                        ${languageRows}
                        <xsl:otherwise>—</xsl:otherwise>
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

  <!-- The last path segment of a URL. XSLT 1.0 has no ends-with() and no
       tokenize(), so this walks past one '/' per call until none is left. -->
  <xsl:template name="basename">
    <xsl:param name="path"/>
    <xsl:choose>
      <xsl:when test="contains($path, '/')">
        <xsl:call-template name="basename">
          <xsl:with-param name="path" select="substring-after($path, '/')"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$path"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>
`;
}

if (import.meta.main) {
  console.log(sitemapXsl());
}
