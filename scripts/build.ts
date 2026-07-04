/*
 * Static site generator (run by Bun: `bun scripts/build.ts`).
 *
 * 1. Bun.build bundles the HTML entry → JS/CSS/font assets with hashed names.
 * 2. For each language we take the built shell, inject the pre-rendered markup
 *    (the same pure `renderApp` the client uses) plus per-language <head> meta,
 *    and write sibling pages at the site root: index.html, fr.html, zh.html.
 *
 * The three pages are siblings (same depth) so every asset path stays relative
 * (`./assets/…`) and the whole `dist/` uploads to any host/bucket path unchanged.
 * Set SITE_URL=https://example.com to emit absolute canonical/hreflang URLs.
 */

import { rm } from 'node:fs/promises';
import { langUrl, renderApp } from '../src/render.ts';
import { HTML_LANG, LANGS, type Lang, translations } from '../src/translations.ts';

const OUT = 'dist';
const SITE = (process.env.SITE_URL ?? '').replace(/\/+$/, '');

function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Public URL of a language's page — relative by default, absolute when SITE_URL is set. */
function href(lang: Lang): string {
  if (!SITE) return langUrl(lang);
  return lang === 'en' ? `${SITE}/` : `${SITE}/${lang}.html`;
}

function outFile(lang: Lang): string {
  return lang === 'en' ? `${OUT}/index.html` : `${OUT}/${lang}.html`;
}

await rm(OUT, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ['./index.html'],
  outdir: OUT,
  minify: true,
  sourcemap: 'linked',
  publicPath: './',
  naming: { asset: 'assets/[name]-[hash].[ext]' },
});

if (!result.success) {
  console.error('Bundle failed:');
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const shell = await Bun.file(`${OUT}/index.html`).text();

for (const lang of LANGS) {
  const t = translations[lang];
  const title = `Jorge Paula Pinheiro — ${t.hero.title}`;
  const description = `${t.hero.title} · ${t.hero.location}`;
  const content = renderApp(lang, 'dark');

  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${HTML_LANG[l]}" href="${attr(href(l))}" />`,
  ).join('\n    ');

  const headExtra = `
    <link rel="canonical" href="${attr(href(lang))}" />
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${attr(href('en'))}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${attr(title)}" />
    <meta property="og:description" content="${attr(description)}" />
    <meta property="og:locale" content="${HTML_LANG[lang]}" />`;

  const html = await new HTMLRewriter()
    .on('html', {
      element(el) {
        el.setAttribute('lang', HTML_LANG[lang]);
        el.setAttribute('data-lang', lang);
      },
    })
    .on('title', { element: (el) => el.setInnerContent(title) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', description) })
    .on('head', { element: (el) => el.append(headExtra, { html: true }) })
    .on('#app', { element: (el) => el.setInnerContent(content, { html: true }) })
    .transform(new Response(shell))
    .text();

  await Bun.write(outFile(lang), html);
  console.log(`  ${outFile(lang)}  (${lang})`);
}

console.log(`\n✓ Pre-rendered ${LANGS.length} pages into ${OUT}/`);
