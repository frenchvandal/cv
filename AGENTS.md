# AGENTS.md—Working conventions for this repo

Guidance for any agent (or human) touching this codebase. It distills the 2026
state-of-the-art TypeScript practices that actually apply **here**—a small,
framework-less, browser-only single-page app. Practices that assume React,
monorepos, or a network/DTO layer are intentionally omitted because this project
has none of them.

## 0. Code style principles

Prioritize simplicity, clarity, and maintainability over cleverness or
verbosity.

- Write the smallest amount of code that cleanly solves the problem.
- Prefer straightforward, explicit solutions over abstract or overly generic
  ones.
- Keep functions short, focused, and easy to understand at a glance.
- Follow DRY, but do not over-abstract or create unnecessary helpers.
- Apply KISS and YAGNI: avoid complexity, duplication of structure, and features
  that are not needed now.
- Use clear names and simple control flow.
- Avoid deep nesting, hidden side effects, and convoluted logic.
- Do not add boilerplate, indirection, or “future-proofing” unless there is a
  real need.
- Optimize for readability first, then performance only when necessary.
- Write code that a human can quickly read, debug, test, and maintain.

When in doubt, choose the simplest implementation that is correct and easy to
modify.

### Comments

- Prefer self-explanatory code over comments.
- Use comments only when the reason is not obvious from the code.
- Comment **why**, not **what**.
- Explain business rules, edge cases, constraints, and non-obvious decisions.
- Do not repeat or paraphrase the code.
- Keep comments short, precise, and up to date.
- Remove stale, misleading, or redundant comments immediately.
- Use `/** ... */` for public APIs or important contracts only.
- Avoid decorative, noisy, or overly verbose comments.

If a comment is needed to make the code understandable, first try to simplify
the code itself

## 1. Stack & shape

- **Runtime/tooling:** Bun (package manager, dev server, bundler). No Vite, no
  Webpack.
  - `bun run dev` → `bun ./index.html` (dev server + HMR,
    http://localhost:3000/).
  - `bun run build` → `bun scripts/build.ts` (bundle + pre-render eight pages
    into `dist/`—seven languages, English written twice as `index.html` and
    `en.html`—plus `404.html`; runs `tsgo --noEmit` concurrently and gates on
    it).
  - `bun run check` → `tsgo --noEmit` (the type gate). `bun test` → unit tests.
  - `bun scripts/social-meta.ts dist/index.html …` → prints the link preview a
    scraper would build from a page. Same HTMLRewriter extraction backs the
    social-card assertions in [scripts/build.test.ts](scripts/build.test.ts), so
    the tags the build writes are checked by something that reads them the way
    their consumers do.
  - `bun scripts/sitemap.ts dist/sitemap.xml` → reads a sitemap back the same
    way. [scripts/sitemap.ts](scripts/sitemap.ts) also **writes** it (the build
    imports it under `SITE_URL`); its header records which protocol fields are
    emitted and why the other two are not—read it before adding one. `<lastmod>`
    comes from `git log` over the paths that reach a visitor, so **all three
    workflows** check out with `fetch-depth: 0`; without history the field is
    omitted rather than guessed, and the assertions in
    [scripts/build.test.ts](scripts/build.test.ts) that compare the build to
    that same lookup would pass on empty against empty. That is why the gates
    need the history too, not just the deploy.
  - [scripts/sitemap-style.ts](scripts/sitemap-style.ts) writes the two browser
    stylesheets the sitemap names in its `<?xml-stylesheet?>` instructions
    (`bun scripts/sitemap-style.ts [css]` prints either; `xmllint` and
    `xsltproc` are how they get checked, and neither is a repo dependency). All
    three files ship together or not at all. The XSLT half is **1.0**, the only
    version browsers run, and it has an end date: Chrome removes XSLT in 158 (17
    November 2026), with Gecko and WebKit agreed to the same. The CSS half is
    the successor, already in place—run Chrome with `--disable-features=XSLT`
    and the file renders through it, which is the only way to see the
    post-removal page today. When the removal lands, delete the XSLT half and
    its instruction; do not try to keep XSLT alive.
  - [scripts/feed.ts](scripts/feed.ts) writes one JSON Feed 1.1 per language,
    also `SITE_URL`-gated. Same rule as the sitemap, and the same header
    convention: every field is justified there, and **no date is ever
    synthesized**—the CV's own ranges (“2019 – Present”) are localized free
    text, so `date_published` is the `git log -S` date of the commit that first
    added the entry's key, and is dropped when git cannot answer. The item set
    is read off the translation objects, so a new role needs no second list.
  - `bun run fonts:update` → `bun scripts/update-fonts.ts`, which re-subsets the
    vendored Noto `.woff2` files from the characters actually used in the source
    literals. Run it after changing copy in
    [src/translations.ts](src/translations.ts) or
    [src/render.ts](src/render.ts)—a glyph that no subset carries renders as
    tofu.
- **Language:** plain TypeScript, no framework. The whole UI is string templates
  emitted by [src/render.ts](src/render.ts). Content lives in
  [src/translations.ts](src/translations.ts) (EN / FR / pt-PT / es-ES / zh-Hans
  / zh-Hant / zh-HK—the regional variants are deliberate, see that file's
  header; `zh-hk` is a lexicon projection of `zh-hant`, not a hand-written
  translation, and is the one language absent from `SWITCHER_LANGS`). Text
  measurement/layout is done with `@chenglou/pretext` in
  [src/measure.ts](src/measure.ts).
- **UI architecture:** an ordinary scrolling document—no deck, no scroll
  jacking, no canvas background. [src/render.ts](src/render.ts) emits stacked
  `<section class="section">` markup and is the **single** renderer: the static
  build ([scripts/build.ts](scripts/build.ts)) calls it at build time to
  pre-render one full page per language, and [src/main.ts](src/main.ts) calls
  the same function at runtime for reload-free language switches. Keep it pure
  (no DOM access) so both callers stay valid—it runs under Bun, outside a
  browser, during the build.
- **Progressive enhancement, strictly.** The pre-rendered HTML is the product;
  every module in the runtime only refines it. With JS off you get the complete,
  readable, navigable CV. See §7 for the enhancement inventory and its rules.
- **Output:** a fully static `dist/` with relative asset paths—deploys to GitHub
  Pages (or any static host) at any base path. CI sets `SITE_URL` for absolute
  SEO URLs.

## 2. Language & syntax—stay erasable

Bun (and Node's native type-stripping) executes TypeScript by **erasing types**,
not transforming syntax. Keep the source erasable so it runs anywhere and stays
bundler-agnostic:

- **No `enum`.** Use a frozen object + a derived union—the pattern already used
  by `LANGS`/`Lang` in [src/translations.ts](src/translations.ts):
  ```ts
  export const LANGS = ["en", "fr", "zh", "zh-hant"] as const;
  export type Lang = (typeof LANGS)[number];
  ```
- **No `namespace`**, no `import =` aliases, no class **parameter properties**
  (`constructor(private x)`). These emit runtime code and break type-stripping.
- **ESM only**, explicit type-only imports:
  `import { type Lang } from './translations'`. This lets the stripper/bundler
  drop them with certainty (see `verbatimModuleSyntax` below).

## 3. Type modeling—guide inference, don't fight it

- **`satisfies`, not `as`.** Validate a value against a type while keeping its
  precise literal inference. `as` is a lie to the compiler—reserve it for real
  escape hatches (DOM casts, untyped libs). Prefer:
  ```ts
  const routes = { home: { method: "GET" } } satisfies Record<string, Route>;
  ```
- **`unknown`, never `any`.** At the only real boundary here—`localStorage`
  (theme in [src/main.ts](src/main.ts))—read defensively and narrow, never
  assume. There is no network/user-data ingestion, so no runtime schema
  validator (Zod) is warranted; if that changes, validate external data at the
  boundary before it enters the app.
- **Let inference work.** Annotate function signatures and module boundaries;
  don't annotate every local. Avoid unreadable conditional-type gymnastics.
- **`NoInfer<T>`** when a secondary generic argument must not widen the inferred
  type (relevant for the small generic helpers like `debounce` in `measure.ts`).

## 4. tsconfig—the safety contract

Current config is `strict` with `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`, `moduleResolution: "bundler"`, **plus** the five
flags below (enabled—keep them on; each catches a real class of bug):

- **`noUncheckedIndexedAccess`**—array/record access returns `T | undefined`.
  This code indexes `translations[lang]`, `nav[id]`, `lines[i]`—this flag forces
  the guards that prevent runtime `undefined` surprises. The one sanctioned
  escape is a `!` on an index the surrounding loop has already bounded
  (`items[i]!` inside `for (i < items.length)`, throughout
  [src/linebreak.ts](src/linebreak.ts)): the guard would be unreachable, and the
  Knuth–Plass inner loops run per line per resize, so a branch that can never be
  taken is noise in the hot path. Everywhere else—anything indexed by a value
  from the DOM, the URL, or a lookup that can legitimately miss—narrow it or
  throw a named error, as `distFontUrl` does in
  [scripts/build.ts](scripts/build.ts).
- **`exactOptionalPropertyTypes`**—distinguishes “key absent” from “key =
  undefined” (matters for the optional fields in `FitFont`/fit options in
  `measure.ts`).
- **`verbatimModuleSyntax`**—forces explicit `import type`, guaranteeing clean
  erasure under Bun.
- **`erasableSyntaxOnly`**—bans runtime TS syntax (enums, namespaces, parameter
  properties). Bun executes these files by _stripping_ types, so anything
  non-erasable would silently change runtime behavior; this makes it a type
  error.
- **`noUncheckedSideEffectImports`**—side-effect imports
  (`import "./styles.css"`) must resolve to a declared module (see
  `src/globals.d.ts`) instead of being silently ignored when the path is wrong.

`include` covers both `src/` and `scripts/` (the build and font scripts are
typed against `@types/bun`). Keep `target` on an evergreen baseline (ES2022+);
this site targets modern browsers only, so don't down-level.

## 5. Tooling & quality gates

- **Type checking is the gate:** `tsgo --noEmit` runs in `build` and in CI. Keep
  it green. The checker is TypeScript 7 (`@typescript/native-preview`, the
  native Go compiler—near-instant, semantics match 6.x). VS Code uses it too via
  `js/ts.experimental.useTsgo` in
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
  dependencies (`@typescript/native-preview`, `@types/bun`) and two runtime
  ones—`@chenglou/pretext` (measurement) and `hyphen` (Liang hyphenation
  patterns, `import()`ed per language). Don't add build tools that Bun already
  covers (bundling, CSS, TS, dev server).

## 6. pretext / measurement conventions (project-specific)

- **Prepare once, then arithmetic.** `prepareWithSegments` is the expensive
  pass—cache it (see `widthPerPxCache` in `measure.ts`). On resize/language
  change, only re-run the cheap width/layout math, never re-prepare identical
  text.
- **Named font required.** pretext is inaccurate with `system-ui`, so the site
  self-hosts **Noto Sans / Noto Sans SC / Noto Sans TC / Noto Sans HK**—four
  faces ([src/fonts.ts](src/fonts.ts))—and every measurement waits for
  `document.fonts.ready`.
- **Fonts are imported, not CSS-`url()`'d.** Bun inlines CSS-referenced fonts as
  base64; importing the `.woff2` (file loader) emits a separate hashed asset and
  keeps `unicode-range` lazy-loading (an EN visitor never fetches the CJK
  subset). The subset files are vendored—regenerate only when the glyph set
  changes.
- **Keep a safety margin** (`MEASURE_SAFETY`) on every fit so rounding never
  causes overflow/clipping.
- **The nav bar has no responsive slack.** It shares `--wrap` with the content,
  so `.nav__links` gets the same ~354px whether the window is 900 or 1728px
  wide—widening the viewport is never the fix for a nav label that overruns.
  `fitNavLinks` spends the gap down to `minGapPx` before it touches the type,
  because 0.8125rem is already the smallest step in the ramp. Watch the budget
  when a translation changes: `auditNavLinks` reports it for every language from
  any page (the brand is 112px in Latin but 161px in Chinese, so the budget is
  not one number), and `.nav__links { overflow: hidden }` is the floor under it
  for a visitor whose JS never runs.
- **A fitter's answer is pre-stated in CSS, or it flashes.** The fitters run
  after `document.fonts.ready`, so whatever [src/styles.css](src/styles.css)
  declares is what the visitor sees first—on load, and again for the ~30ms after
  a language switch replaces `#app`. When the two disagree the size snaps in
  front of the reader, which is how the hero shipped at 88px and settled at 76
  for months. So `.hero__name` carries the fit as a `clamp` and the three
  overrunning languages carry `fitNavLinks`' own output, `column-gap` included
  (bake the type without the gap and the row is still 40px off). Two rules hold
  it together: the bounds are **px**, because `HERO_FIT`/`NAV_FIT` are px and
  `rem` would drift from them under a changed root font size; and every number
  that is not measured is asserted against its constant in
  [src/styles.test.ts](src/styles.test.ts). Only the width of the rendered text
  needs a browser—re-measure it when the name or the display font changes.
- **Knuth–Plass.** [src/linebreak.ts](src/linebreak.ts) runs optimal (TeX-style)
  line breaking over pretext-measured boxes/glue, with `hyphen` supplying
  syllable break points, to justify the About paragraphs. Glue uses `shrink: 0`
  because CSS `text-align: justify` can only stretch spaces, never shrink them—
  keep that invariant, and keep the small target-width margin, or lines will
  wrap.

## 7. Rendering & enhancement conventions (project-specific)

- **The enhancement inventory.** Each runs after paint, none is load-bearing:
  pretext-measured fitting of the hero name, the section titles and the nav
  shortcuts ([src/measure.ts](src/measure.ts)), Knuth–Plass re-typesetting of
  the About paragraphs ([src/linebreak.ts](src/linebreak.ts)), tight-wrapped
  chat bubbles ([src/chat.ts](src/chat.ts)), reveal-on-scroll with stat
  counters, the theme toggle, and reload-free language switching. If any one
  fails, the pre-rendered content stays on screen—write them so a failure is a
  no-op, never a blank.
- **Language negotiation runs at the ROOT ONLY, and redirects.** `index.html`
  carries an inline `<head>` script (generated by `languageNegotiationScript` in
  [src/render.ts](src/render.ts), injected by
  [scripts/build.ts](scripts/build.ts)) that sends a visitor to the page in
  their language. Three rules hold it together, and each one is load-bearing: a
  URL that **names** a language is never redirected, or shared links would
  change language on the recipient—which is why the script is never injected
  into anything but `index.html` (`outFiles` in
  [scripts/build.ts](scripts/build.ts) marks the root, and only the root,
  `negotiates`), rather than injected everywhere behind a runtime path check; it
  uses `location.replace`, so the root never becomes a history entry and Back is
  not trapped in a redirect loop; and a hand-picked language (localStorage
  `cv-lang`, written only on an explicit switcher click, never on popstate)
  outranks the browser list. The matching rule lives **once**, as ES5 inside
  that generated script, because it has to run before the bundle exists; resist
  adding a “proper” TypeScript twin, since the script is its only caller and a
  second copy would just be one more thing to keep in step. The test in
  [src/render.test.ts](src/render.test.ts) executes that shipped source against
  a stubbed browser instead.
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
  the pre-rendered markup, so `init` binds events instead of rebuilding—keep the
  two byte-identical, or first paint will flash.
- **Colour discipline.** One neutral ramp plus a single accent—the system blue
  (`#0071e3` light / `#0a84ff` dark, [src/styles.css](src/styles.css)).
  Interactive states use that accent, hairline borders, or fg/bg inversion.
  Don't introduce a second hue.
- **Dev-only code is feature-gated.** `feature("PROD")` from `bun:bundle` (the
  production build passes `features: ["PROD"]`) compiles the title audit down to
  `if (false)` and tree-shakes it out. Use the same gate for any new diagnostic
  rather than a `NODE_ENV` check.
- **Print is a real target, narrowly.** A CV gets printed, and the reveal system
  is scroll-driven: without the `@media print` block in
  [src/styles.css](src/styles.css), every `.animate` section below the fold
  prints at `opacity: 0`—blank pages. That block does four things and should not
  grow past them: force the reveals visible, hide chrome that means nothing on
  paper (nav, skip link, hero actions, copy button), let the hero size to its
  content, and keep events and cards whole across page breaks. The dark palette
  is scoped to `@media screen` for the same reason.

## 8. `experiments/`—a slot, currently empty

There is no `experiments/` directory today. The convention is kept because the
directory is meant to come and go: it holds **open questions**, not history, and
is deleted the moment one is resolved.

If you create it again, it is **not** a scratch directory—nothing lands there
unless it is typechecked, tested, and carries a `README.md` stating what it
proves and what adoption would cost. Add `experiments/**/*.ts` back to the
tsconfig `include` so it sits inside the gates: an experiment that cannot
survive `bun run check` is not kept, because a rotting prototype reads as a
working option. Nothing in `src/` may import it—the arrow points one way, and
adopting one means moving the code into `src/`, not adding an import. Where an
experiment forks a shipping module, assert with an **equivalence test over every
input the original accepts** that the fork still matches it; a prose claim of
equivalence is what lets a fork drift.

Ruled out so far, so it is not rediscovered:

- **rich-linebreak** (removed 2026-07-27)—a run-aware Knuth–Plass fork letting a
  justified paragraph carry inline markup. The shipping breaker takes one font
  and returns flat strings, so inline styles are both mis-measured (+8.1% for a
  monospace span, against a 6px margin) and erased. Not adopted: the CV's prose
  is flat text, and italic—the one style it might want—measures identically in
  Noto Sans. It also proved that `@chenglou/pretext/rich-inline` is _not_ the
  answer: it is a greedy breaker, so it would trade the optimal line breaking
  away to get rich text. It drifted exactly as predicted—its `loadHyphenator`
  was still the en/fr ternary when `src/linebreak.ts` had gained pt and es—
  because its equivalence test only ever exercised `"en"`.
