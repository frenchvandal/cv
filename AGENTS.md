# AGENTS.md — Working conventions for this repo

Guidance for any agent (or human) touching this codebase. It distills the 2026
state-of-the-art TypeScript practices that actually apply **here** — a small,
framework-less, browser-only single-page app. Practices that assume React,
monorepos, or a network/DTO layer are intentionally omitted because this project
has none of them.

## 1. Stack & shape

- **Runtime/tooling:** Bun (package manager, dev server, bundler). No Vite, no
  Webpack.
  - `bun run dev` → `bun ./index.html` (dev server + HMR,
    http://localhost:3000/).
  - `bun run build` → `bun scripts/build.ts` (bundle + pre-render the four
    language pages into `dist/`; runs `tsgo --noEmit` concurrently and gates on
    it).
  - `bun run check` → `tsgo --noEmit` (the type gate). `bun test` → unit tests.
    `bun run check:rust` → `cargo fmt --all --check` + `cargo clippy` with
    warnings denied (the Rust lint gate, also run in CI). `cargo test` is N/A:
    the crate is `no_std` with `panic = "abort"`, so the test harness can't
    link.
  - `bun run wasm:build` →
    `cargo build --release --target wasm32-unknown-unknown` (root Cargo
    workspace) and copies the artifact to `src/dither.wasm`. CI (ci.yaml +
    deploy.yaml) installs the Rust toolchain, runs `check:rust`, then this
    before `bun run build`, so the deployed bundle always carries a fresh
    engine. The compiled .wasm is ALSO committed so local dev (`bun run dev`)
    works without a Rust install — rebuild + commit it when you change the
    crate.
- **Language:** plain TypeScript, no framework. The whole UI is string templates
  rendered into `#app` by [src/main.ts](src/main.ts). Content lives in
  [src/translations.ts](src/translations.ts) (EN / FR / zh-Hans / zh-Hant). Text
  measurement/layout is done with `@chenglou/pretext` in
  [src/measure.ts](src/measure.ts).
- **UI architecture (2026 redesign, after careers.kimi.com):** the page is a
  deck of full-screen panels. [src/render.ts](src/render.ts) emits plain stacked
  `<section class="panel">` markup (valid SSG/no-JS flow); on desktop without
  `prefers-reduced-motion`, [src/panels.ts](src/panels.ts) adds `panels-on` to
  `<html>` and scroll-jacks between panels (wheel/touch/keyboard/hash, dither
  wipe transitions, internal-scroll edge guard for overflowing panels).
  [src/dither.ts](src/dither.ts) drives the background: FBM nebula + Bayer
  ordered dithering computed in Rust ([wasm/dither/](wasm/dither/), `no_std`,
  raw exports, no wasm-bindgen), painted to a low-res canvas upscaled with
  `image-rendering: pixelated`. If the wasm fails, a CSS gradient fallback
  paints instead — the page never depends on the engine.
- **Rust:** stable toolchain via rustup (`~/.cargo`). Root `Cargo.toml` is a
  workspace so `cargo clippy` / `cargo fmt` work at the repo root; build
  profiles live there (member-crate profiles are ignored). `no_std` needs
  `panic = "abort"` in every profile (dev included). VS Code: rust-analyzer with
  clippy-on-save + formatOnSave (see .vscode/settings.json).
- **Output:** a fully static `dist/` with relative asset paths — deploys to
  GitHub Pages (or any static host) at any base path. CI sets `SITE_URL` for
  absolute SEO URLs.

## 2. Language & syntax — stay erasable

Bun (and Node's native type-stripping) executes TypeScript by **erasing types**,
not transforming syntax. Keep the source erasable so it runs anywhere and stays
bundler-agnostic:

- **No `enum`.** Use a frozen object + a derived union — the pattern already
  used by `LANGS`/`Lang` in [src/translations.ts](src/translations.ts):
  ```ts
  export const LANGS = ["en", "fr", "zh", "zh-hant"] as const;
  export type Lang = (typeof LANGS)[number];
  ```
- **No `namespace`**, no `import =` aliases, no class **parameter properties**
  (`constructor(private x)`). These emit runtime code and break type-stripping.
- **ESM only**, explicit type-only imports:
  `import { type Lang } from './translations'`. This lets the stripper/bundler
  drop them with certainty (see `verbatimModuleSyntax` below).

## 3. Type modeling — guide inference, don't fight it

- **`satisfies`, not `as`.** Validate a value against a type while keeping its
  precise literal inference. `as` is a lie to the compiler — reserve it for real
  escape hatches (DOM casts, untyped libs). Prefer:
  ```ts
  const routes = { home: { method: "GET" } } satisfies Record<string, Route>;
  ```
- **`unknown`, never `any`.** At the only real boundary here — `localStorage`
  (theme in [src/main.ts](src/main.ts)) — read defensively and narrow, never
  assume. There is no network/user-data ingestion, so no runtime schema
  validator (Zod) is warranted; if that changes, validate external data at the
  boundary before it enters the app.
- **Let inference work.** Annotate function signatures and module boundaries;
  don't annotate every local. Avoid unreadable conditional-type gymnastics.
- **`NoInfer<T>`** when a secondary generic argument must not widen the inferred
  type (relevant for the small generic helpers like `debounce` in `measure.ts`).

## 4. tsconfig — the safety contract

Current config is `strict` with `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`, `moduleResolution: "bundler"`, **plus** the five
flags below (enabled — keep them on; each catches a real class of bug):

- **`noUncheckedIndexedAccess`** — array/record access returns `T | undefined`.
  This code indexes `translations[lang]`, `nav[id]`, `lines[i]` — this flag
  forces the guards that prevent runtime `undefined` surprises.
- **`exactOptionalPropertyTypes`** — distinguishes "key absent" from "key =
  undefined" (matters for the optional fields in `FitFont`/fit options in
  `measure.ts`).
- **`verbatimModuleSyntax`** — forces explicit `import type`, guaranteeing clean
  erasure under Bun.
- **`erasableSyntaxOnly`** — bans runtime TS syntax (enums, namespaces,
  parameter properties). Bun executes these files by _stripping_ types, so
  anything non-erasable would silently change runtime behavior; this makes it a
  type error.
- **`noUncheckedSideEffectImports`** — side-effect imports
  (`import "./styles.css"`) must resolve to a declared module (see
  `src/globals.d.ts`) instead of being silently ignored when the path is wrong.

`include` covers both `src/` and `scripts/` (the build and font scripts are
typed against `@types/bun`). Keep `target` on an evergreen baseline (ES2022+);
this site targets modern browsers only, so don't down-level.

## 5. Tooling & quality gates

- **Type checking is the gate:** `tsgo --noEmit` runs in `build` and in CI. Keep
  it green. The checker is TypeScript 7 (`@typescript/native-preview`, the
  native Go compiler — near-instant, semantics match 6.x). VS Code uses it too
  via `js/ts.experimental.useTsgo` in
  [.vscode/settings.json](.vscode/settings.json).
- **Formatting vs linting are separate concerns.** If a linter is added, use
  ESLint **flat config** (`eslint.config.ts`) with `typescript-eslint` v8 and
  type-aware rules via the Project Service:
  ```ts
  parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
  ```
  Let a formatter own formatting; end the ESLint config with
  `eslint-config-prettier` to disable conflicting rules. Never run the formatter
  _through_ ESLint.
- **No dead tooling.** Dependencies are deliberately minimal: two dev
  dependencies (`@typescript/native-preview`, `@types/bun`) and two runtime ones
  — `@chenglou/pretext` (measurement) and `hyphen` (Liang hyphenation patterns,
  `import()`ed per language). Don't add build tools that Bun already covers
  (bundling, CSS, TS, dev server).

## 6. pretext / measurement conventions (project-specific)

- **Prepare once, then arithmetic.** `prepareWithSegments` is the expensive pass
  — cache it (see `widthPerPxCache` in `measure.ts`). On resize/language change,
  only re-run the cheap width/layout math, never re-prepare identical text.
- **Named font required.** pretext is inaccurate with `system-ui`, so the site
  self-hosts **Noto Sans / Noto Sans SC / Noto Sans TC**
  ([src/fonts.ts](src/fonts.ts)) and every measurement waits for
  `document.fonts.ready`.
- **Fonts are imported, not CSS-`url()`'d.** Bun inlines CSS-referenced fonts as
  base64; importing the `.woff2` (file loader) emits a separate hashed asset and
  keeps `unicode-range` lazy-loading (an EN visitor never fetches the CJK
  subset). The subset files are vendored — regenerate only when the glyph set
  changes.
- **Keep a safety margin** (`MEASURE_SAFETY`) on every fit so rounding never
  causes overflow/clipping.
- **Knuth–Plass.** [src/linebreak.ts](src/linebreak.ts) runs optimal (TeX-style)
  line breaking over pretext-measured boxes/glue, with `hyphen` supplying
  syllable break points, to justify the About paragraphs. Glue uses `shrink: 0`
  because CSS `text-align: justify` can only stretch spaces, never shrink them —
  keep that invariant, and keep the small target-width margin, or lines will
  wrap.

## 7. Panel deck & dither conventions (project-specific)

- **Progressive enhancement order.** Markup must stay a readable stacked
  document without JS; deck styling lives exclusively behind `html.panels-on` in
  [src/styles.css](src/styles.css). Deck mode =
  `matchMedia("(min-width:
  56rem)")` AND NOT reduced-motion — mirrored in
  [src/panels.ts](src/panels.ts), keep the two in sync.
- **Hidden panels use `visibility`, never `display`** — pretext measures
  geometry (orbs stage, hero fit) even on inactive panels.
- **Re-render wipes DOM.** Language switches replace `#app` innerHTML, so
  long-lived elements (the dither canvas) attach to `<body>`, and controllers
  re-query on every `afterPaint` (`initPanels` is idempotent).
- **Monochrome discipline.** No hue anywhere: interactive states use fg/bg
  inversion, borders, or the hard offset shadow (`--shadow-hard`). The orbs
  differ by border style + Bayer-tile density (`--tile-1..4` data-URIs, defined
  per theme), set in CSS modifier classes — `orbs.ts` only sets geometry inline.
- **The dither engine contract** (wasm/dither/src/lib.rs):
  `init/resize(cols,
  rows) -> 0|-1`, `render(t_ms, mode, blend, flags)` with
  mode 0 nebula / 1 wipe / 2 static, `flags & 1` = light theme,
  `frame_ptr/frame_len` expose an RGBA buffer over a static arena (max 640×400
  cells — keep src/dither.ts's MAX_COLS/MAX_ROWS in sync). `src/dither.wasm` is
  committed; after editing the crate, run `bun run wasm:build` and commit the
  new artifact.
- **No print stylesheet** — the deck is screen-only by design (dropped in the
  2026 redesign on purpose).
