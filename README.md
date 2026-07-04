# Jorge Paula Pinheiro — CV

A trilingual (EN / FR / ZH) portfolio, pre-rendered to static HTML and progressively
enhanced with pretext-driven typography. No framework.

## Stack

- **[Bun](https://bun.com)** — package manager, dev server and bundler (no Vite/Webpack).
- **TypeScript** (vanilla, no UI framework). The UI is plain string templates in
  [src/render.ts](src/render.ts), rendered into `#app`.
- **[@chenglou/pretext](https://github.com/chenglou/pretext)** — text measurement/layout
  (canvas, no DOM reflow), driving the measurement features below.
- **[hyphen](https://www.npmjs.com/package/hyphen)** — Liang syllable hyphenation patterns.

## Features

- **SSG pre-render** — [scripts/build.ts](scripts/build.ts) emits `index.html`, `fr.html`
  and `zh.html` with the content already in the HTML (SEO, link previews, works with JS
  off). The client hydrates and swaps language instantly — no reload — syncing the URL via
  `history`.
- **Measurement-driven layout** ([src/measure.ts](src/measure.ts)) — pretext fits the hero
  name to the viewport width and sizes the section titles to their column (uniform, no
  ellipsis truncation) across all three languages. A dev-only console audit flags any title
  that would overflow.
- **Knuth–Plass justification** ([src/linebreak.ts](src/linebreak.ts)) — the About
  paragraphs are re-typeset with TeX-style optimal line breaking and syllable hyphenation,
  over pretext-measured boxes/glue (Latin languages; Chinese wraps natively).
- **Self-hosted fonts** — Noto Sans + Noto Sans SC, subset to the glyphs actually used and
  imported so Bun emits them as external hashed files; `unicode-range` keeps the Chinese
  subset lazy. No web-font CDN, no runtime network dependency.
- **Light / dark theme**, reveal-on-scroll, animated stats.

## Commands

```bash
bun install            # install dependencies
bun run dev            # dev server with HMR → http://localhost:3000/
bun run build          # type-check + pre-render the 3 pages into dist/
bun run check          # tsc --noEmit (the type gate)
bun run fonts:update   # regenerate the Noto subsets (only when new glyphs are added)
```

## Deploy

`bun run build` produces a self-contained `dist/` with **relative asset paths**, so it
uploads to any static host or cloud-storage bucket — at any path — with no configuration
(and works on GitHub Pages too). Set `SITE_URL=https://example.com` before building to emit
absolute canonical / `hreflang` URLs.

The included GitHub Actions workflow builds with Bun and publishes `dist/` to Pages.

## Editing content

All copy lives in [src/translations.ts](src/translations.ts), typed so the three languages
stay in structural sync. See [AGENTS.md](AGENTS.md) for the code conventions.

## License

© 2026 Jorge Paula Pinheiro. All rights reserved.
