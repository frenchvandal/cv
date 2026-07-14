# Philippe Ribeiro — CV

A four-language (EN / FR / 简体 / 繁體) portfolio, pre-rendered to static HTML and
progressively enhanced with pretext-driven typography. No framework.

## Stack

- **[Bun](https://bun.com)** — package manager, dev server and bundler (no Vite/Webpack).
- **TypeScript** (vanilla, no UI framework). The UI is plain string templates in
  [src/render.ts](src/render.ts), rendered into `#app`.
- **[@chenglou/pretext](https://github.com/chenglou/pretext)** — text measurement/layout
  (canvas, no DOM reflow), driving the measurement features below.
- **[hyphen](https://www.npmjs.com/package/hyphen)** — Liang syllable hyphenation patterns.

## Features

- **SSG pre-render** — [scripts/build.ts](scripts/build.ts) emits `index.html`, `fr.html`,
  `zh.html` and `zh-hant.html` with the content already in the HTML (SEO, link previews, works with JS
  off). The client hydrates and swaps language instantly — no reload — syncing the URL via
  `history`.
- **Measurement-driven layout** ([src/measure.ts](src/measure.ts)) — pretext fits the hero
  name to the viewport width and sizes the section titles to their column (uniform, no
  ellipsis truncation) across all four languages. A dev-only console audit flags any title
  that would overflow.
- **About orbs** ([src/orbs.ts](src/orbs.ts)) — the About paragraphs flow around four
  draggable, labelled circles (real anchors to their sections), re-laid-out each frame
  with pretext. Falls back to the layout below when it can't run.
- **Knuth–Plass justification** ([src/linebreak.ts](src/linebreak.ts)) — the About
  paragraphs are re-typeset with TeX-style optimal line breaking and syllable hyphenation,
  over pretext-measured boxes/glue (Latin languages; Chinese wraps natively). The
  hyphenation patterns load per language, on demand.
- **Self-hosted fonts** — Noto Sans + Noto Sans SC/TC, subset per language to the glyphs
  actually used and imported so Bun emits them as external hashed files; `unicode-range`
  and per-page font stacks keep each Chinese subset lazy. No web-font CDN, no runtime network dependency.
- **Light / dark theme**, reveal-on-scroll, animated stats.

## Commands

```bash
bun install            # install dependencies
bun run dev            # dev server with HMR → http://localhost:3000/
bun run build          # type-check + pre-render the 4 pages into dist/
bun run check          # tsgo --noEmit (TypeScript 7 native compiler, the type gate)
bun test               # Knuth–Plass unit tests (canvas-free, injected measure)
bun run fonts:update   # regenerate the Noto subsets (only when new glyphs are added)
```

## Deploy

`bun run build` produces a self-contained `dist/` with **relative asset paths**, so it
uploads to any static host or cloud-storage bucket — at any path — with no configuration
(and works on GitHub Pages too). Set `SITE_URL=https://example.com` before building to emit
absolute canonical / `hreflang` URLs, a sitemap, and the `og:image` / Twitter-card tags for
social link previews (search engines and social scrapers require absolute URLs there). The
preview image itself is [public/og-image.png](public/og-image.png), copied to the site root
at build time.

The included GitHub Actions workflow builds with Bun and publishes `dist/` to Pages; it
sets `SITE_URL` automatically from the Pages base URL. A second workflow type-checks,
tests and builds every pull request.

## Editing content

All copy lives in [src/translations.ts](src/translations.ts), typed so the four languages
stay in structural sync. See [AGENTS.md](AGENTS.md) for the code conventions.

## License

© 2026 Philippe Ribeiro. All rights reserved.
