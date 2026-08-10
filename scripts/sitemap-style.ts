/*
 * How dist/sitemap.xml looks to a person who opens it: CSS applied to the XML
 * tree as it stands, named by [scripts/sitemap.ts](scripts/sitemap.ts) in an
 * `<?xml-stylesheet?>` instruction.
 *
 * There used to be an XSLT 1.0 stylesheet beside it, drawing a table with the
 * URLs as links and each page's language. It was deleted rather than kept to
 * the end: Chrome removes XSLT in 158, with WebKit and Gecko agreed, and in
 * the meantime it had already fallen out of step with the site — it read each
 * page's language from a file name, which the move to per-language folders had
 * made meaningless. A second language to keep in step, for a few months of
 * life, in exchange for a table.
 *
 * What CSS cannot do is worth stating: it cannot create a link, and no
 * selector can read element text, so the URLs are inert and there is no
 * language column. That is the whole cost.
 *
 * This is chrome, not content, so it borrows the site's palette but not its
 * fonts: the hashed `assets/noto-sans-*.woff2` names are only known to the
 * bundler, and a stylesheet that guessed at one would ship a 404. Same call,
 * and the same system stack, as the 404 page in
 * [scripts/build.ts](scripts/build.ts).
 *
 * None of this reaches a machine. The instruction is not part of the
 * sitemaps.org 0.9 vocabulary; crawlers and `parseSitemap` read the same bytes
 * they always did.
 */

import { THEME_COLOR } from "../src/config.ts";
// The name lives with the file that references it, so the dependency runs
// one way: this module produces what sitemap.ts declares.
import { SITEMAP_NS } from "./sitemap.ts";

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
  console.log(sitemapCss());
}
