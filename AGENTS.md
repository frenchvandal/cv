# AGENTS.md — Working conventions for this repo

Guidance for any agent (or human) touching this codebase. It distills the 2026
state-of-the-art TypeScript practices that actually apply **here** — a small,
framework-less, browser-only single-page app. Practices that assume React,
monorepos, or a network/DTO layer are intentionally omitted because this project
has none of them.

## 1. Stack & shape

- **Runtime/tooling:** Bun (package manager, dev server, bundler). No Vite, no Webpack.
  - `bun run dev` → `bun ./index.html` (dev server + HMR, http://localhost:3000/).
  - `bun run build` → `tsc --noEmit && rm -rf dist && bun build ./index.html --outdir=dist --public-path=/cv/ --minify --sourcemap=linked`.
  - `bun run check` → `tsc --noEmit` (the type gate).
- **Language:** plain TypeScript, no framework. The whole UI is string templates
  rendered into `#app` by [src/main.ts](src/main.ts). Content lives in
  [src/translations.ts](src/translations.ts) (EN/FR/ZH). Text measurement/layout
  is done with `@chenglou/pretext` in [src/measure.ts](src/measure.ts).
- **Output:** a fully static site deployed to GitHub Pages under `/cv/`.

## 2. Language & syntax — stay erasable

Bun (and Node's native type-stripping) executes TypeScript by **erasing types**,
not transforming syntax. Keep the source erasable so it runs anywhere and stays
bundler-agnostic:

- **No `enum`.** Use a frozen object + a derived union — the pattern already used
  by `LANGS`/`Lang` in [src/translations.ts](src/translations.ts):
  ```ts
  export const LANGS = ['en', 'fr', 'zh', 'zh-hant'] as const;
  export type Lang = (typeof LANGS)[number];
  ```
- **No `namespace`**, no `import =` aliases, no class **parameter properties**
  (`constructor(private x)`). These emit runtime code and break type-stripping.
- **ESM only**, explicit type-only imports: `import { type Lang } from './translations'`.
  This lets the stripper/bundler drop them with certainty (see `verbatimModuleSyntax` below).

## 3. Type modeling — guide inference, don't fight it

- **`satisfies`, not `as`.** Validate a value against a type while keeping its
  precise literal inference. `as` is a lie to the compiler — reserve it for real
  escape hatches (DOM casts, untyped libs). Prefer:
  ```ts
  const routes = { home: { method: 'GET' } } satisfies Record<string, Route>;
  ```
- **`unknown`, never `any`.** At the only real boundary here — `localStorage`
  (theme in [src/main.ts](src/main.ts)) — read defensively and narrow, never assume.
  There is no network/user-data ingestion, so no runtime schema validator (Zod) is
  warranted; if that changes, validate external data at the boundary before it
  enters the app.
- **Let inference work.** Annotate function signatures and module boundaries;
  don't annotate every local. Avoid unreadable conditional-type gymnastics.
- **`NoInfer<T>`** when a secondary generic argument must not widen the inferred
  type (relevant for the small generic helpers like `debounce` in `measure.ts`).

## 4. tsconfig — the safety contract

Current config is already `strict` with `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`, `moduleResolution: "bundler"`. Recommended additions
(enable, then fix the fallout — each catches a real class of bug):

- **`noUncheckedIndexedAccess`** — array/record access returns `T | undefined`.
  This code indexes `translations[lang]`, `nav[id]`, `lines[i]` — this flag forces
  the guards that prevent runtime `undefined` surprises.
- **`exactOptionalPropertyTypes`** — distinguishes "key absent" from "key = undefined"
  (matters for the optional fields in `FitFont`/fit options in `measure.ts`).
- **`verbatimModuleSyntax`** — forces explicit `import type`, guaranteeing clean
  erasure under Bun.
- Keep `target` on an evergreen baseline (ES2022+); this site targets modern
  browsers only, so don't down-level.

## 5. Tooling & quality gates

- **Type checking is the gate:** `tsc --noEmit` runs in `build` and in CI. Keep it green.
  (Optional speed-up: TypeScript 7 — the Go compiler — as `typescript@rc` for
  near-instant `tsc --noEmit`; semantics match 6.x.)
- **Formatting vs linting are separate concerns.** If a linter is added, use
  ESLint **flat config** (`eslint.config.ts`) with `typescript-eslint` v8 and
  type-aware rules via the Project Service:
  ```ts
  parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
  ```
  Let a formatter own formatting; end the ESLint config with `eslint-config-prettier`
  to disable conflicting rules. Never run the formatter *through* ESLint.
- **No dead tooling.** Dependencies are deliberately minimal: one dev dependency
  (`typescript`) and two runtime ones — `@chenglou/pretext` (measurement) and
  `hyphen` (Liang hyphenation patterns). Don't add build tools that Bun already
  covers (bundling, CSS, TS, dev server).

## 6. pretext / measurement conventions (project-specific)

- **Prepare once, then arithmetic.** `prepareWithSegments` is the expensive pass —
  cache it (see `widthPerPxCache` in `measure.ts`). On resize/language change, only
  re-run the cheap width/layout math, never re-prepare identical text.
- **Named font required.** pretext is inaccurate with `system-ui`, so the site
  self-hosts **Noto Sans / Noto Sans SC / Noto Sans TC** ([src/fonts.ts](src/fonts.ts)) and every
  measurement waits for `document.fonts.ready`.
- **Fonts are imported, not CSS-`url()`'d.** Bun inlines CSS-referenced fonts as
  base64; importing the `.woff2` (file loader) emits a separate hashed asset and
  keeps `unicode-range` lazy-loading (an EN visitor never fetches the CJK subset).
  The subset files are vendored — regenerate only when the glyph set changes.
- **Keep a safety margin** (`MEASURE_SAFETY`) on every fit so rounding never causes
  overflow/clipping.
- **Knuth–Plass.** [src/linebreak.ts](src/linebreak.ts) runs optimal (TeX-style)
  line breaking over pretext-measured boxes/glue, with `hyphen` supplying syllable
  break points, to justify the About paragraphs. Glue uses `shrink: 0` because CSS
  `text-align: justify` can only stretch spaces, never shrink them — keep that
  invariant, and keep the small target-width margin, or lines will wrap.
