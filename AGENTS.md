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
  - `bun run fonts:update` → `bun scripts/update-fonts.ts`, which re-subsets the
    vendored Noto `.woff2` files from the characters actually used in the source
    literals. Run it after changing copy in
    [src/translations.ts](src/translations.ts) or [src/render.ts](src/render.ts)
    — a glyph that no subset carries renders as tofu.
- **Language:** plain TypeScript, no framework. The whole UI is string templates
  emitted by [src/render.ts](src/render.ts). Content lives in
  [src/translations.ts](src/translations.ts) (EN / FR / zh-Hans / zh-Hant). Text
  measurement/layout is done with `@chenglou/pretext` in
  [src/measure.ts](src/measure.ts).
- **UI architecture:** an ordinary scrolling document — no deck, no scroll
  jacking, no canvas background. [src/render.ts](src/render.ts) emits stacked
  `<section class="section">` markup and is the **single** renderer: the static
  build ([scripts/build.ts](scripts/build.ts)) calls it at build time to
  pre-render one full page per language, and [src/main.ts](src/main.ts) calls
  the same function at runtime for reload-free language switches. Keep it pure
  (no DOM access) so both callers stay valid — it runs under Bun, outside a
  browser, during the build.
- **Progressive enhancement, strictly.** The pre-rendered HTML is the product;
  every module in the runtime only refines it. With JS off you get the complete,
  readable, navigable CV. See §7 for the enhancement inventory and its rules.
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
  forces the guards that prevent runtime `undefined` surprises. The one
  sanctioned escape is a `!` on an index the surrounding loop has already
  bounded (`items[i]!` inside `for (i < items.length)`, throughout
  [src/linebreak.ts](src/linebreak.ts)): the guard would be unreachable, and the
  Knuth–Plass inner loops run per line per resize, so a branch that can never be
  taken is noise in the hot path. Everywhere else — anything indexed by a value
  from the DOM, the URL, or a lookup that can legitimately miss — narrow it or
  throw a named error, as `distFontUrl` does in
  [scripts/build.ts](scripts/build.ts).
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

## 7. Rendering & enhancement conventions (project-specific)

- **The enhancement inventory.** Each runs after paint, none is load-bearing:
  pretext-measured fitting of the hero name and section titles
  ([src/measure.ts](src/measure.ts)), Knuth–Plass re-typesetting of the About
  paragraphs ([src/linebreak.ts](src/linebreak.ts)), tight-wrapped chat bubbles
  ([src/chat.ts](src/chat.ts)), reveal-on-scroll with stat counters, the theme
  toggle, and reload-free language switching. If any one fails, the pre-rendered
  content stays on screen — write them so a failure is a no-op, never a blank.
- **Measure only after `document.fonts.ready`.** Every pretext call goes through
  `whenFontsReady` and uses the page's _live_ font stack
  (`getComputedStyle(document.body).fontFamily`), so CJK pages measure with the
  family they actually render in. Measuring against a fallback silently produces
  wrong widths.
- **Re-render wipes the DOM.** A language switch replaces `#app` innerHTML, so
  no enhancement may hold a reference across it: controllers re-query on every
  `afterPaint`, and async work re-checks
  `lang !== currentLang || !el.isConnected` before touching the DOM it started
  from (see `enhanceAboutKp`).
- **Hydration over re-render.** On first load, `renderApp` output already equals
  the pre-rendered markup, so `init` binds events instead of rebuilding — keep
  the two byte-identical, or first paint will flash.
- **Colour discipline.** One neutral ramp plus a single accent — the system blue
  (`#0071e3` light / `#0a84ff` dark, [src/styles.css](src/styles.css)).
  Interactive states use that accent, hairline borders, or fg/bg inversion.
  Don't introduce a second hue.
- **Dev-only code is feature-gated.** `feature("PROD")` from `bun:bundle` (the
  production build passes `features: ["PROD"]`) compiles the title audit down to
  `if (false)` and tree-shakes it out. Use the same gate for any new diagnostic
  rather than a `NODE_ENV` check.
- **No print stylesheet** — screen-only by design.
