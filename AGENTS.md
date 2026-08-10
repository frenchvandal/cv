# AGENTS.md—Working Conventions for This Repo

Guidance for any agent (or human) touching this codebase. It distills the 2026
state-of-the-art TypeScript practices that actually apply **here**: a small,
framework-less, browser-only single-page app. Practices that assume React,
monorepos, or a network/DTO layer are intentionally omitted, because this
project has none of them.

Sections 1 and 2 orient. Sections 3 through 7 are general rules. Sections 8
through 10 are the project-specific conventions, the ones that are expensive to
rediscover.

## 1. Stack and Shape

- **Runtime and tooling:** Bun (package manager, dev server, bundler). No Vite,
  no Webpack. See §2 for the commands.
- **Language:** plain TypeScript, no framework. The whole UI is string templates
  emitted by the `src/render*` modules. Interface copy and the CV live in
  [src/translations.ts](src/translations.ts): EN, FR, pt-PT, es-ES, zh-Hans,
  zh-Hant, and zh-HK. The regional variants are deliberate; see that file’s
  header. `zh-hk` is a lexicon projection of `zh-hant`, not a hand-written
  translation, and it is the one language absent from `SWITCHER_LANGS`. Blog
  articles live on disk in `content/posts/<slug>/<lang>.md`, loaded by
  [scripts/content.ts](scripts/content.ts). Text measurement and layout are done
  with `@chenglou/pretext` in [src/measure.ts](src/measure.ts).
- **UI architecture:** an ordinary scrolling document—no deck, no scroll
  jacking, no canvas background. [src/render.ts](src/render.ts) is a **facade**:
  the chrome and URL helpers are [src/render/shell.ts](src/render/shell.ts), the
  CV chapters [src/render/cv.ts](src/render/cv.ts), the blog pages
  [src/render/blog.ts](src/render/blog.ts). All of it stays pure (no DOM
  access), because the static build ([scripts/build.ts](scripts/build.ts)) and
  the runtime ([src/main.ts](src/main.ts)) call the same `renderPage`—the build
  pre-renders every page, the client re-renders only the CV on a reload-free
  language switch; on home, index and article pages the switcher is plain
  navigation.
- **Progressive enhancement, strictly.** The pre-rendered HTML is the product;
  every module in the runtime only refines it. With JS off you get the complete,
  readable, navigable site. See §9 for the enhancement inventory and its rules.
- **Layout:** English at the root, every other language in its folder, one page
  per article under `<lang>/blog/`. Asset paths are computed from each page’s
  depth (`rel(depth)` in [src/urls.ts](src/urls.ts)) and stay relative—`dist/`
  deploys to any base path. The pre-blog URLs (`fr.html`, `en.html`) are kept
  alive by noindex relay pages ([scripts/relay.ts](scripts/relay.ts)).
- **Output:** a fully static `dist/` with relative asset paths—it deploys to
  GitHub Pages (or any static host) at any base path. CI sets `SITE_URL` for
  absolute SEO URLs.

## 2. Commands and Generated Files

### Commands

- `bun run dev` → `bun ./index.html` (dev server and HMR,
  http://localhost:3000/).
- `bun run build` → `bun scripts/build.ts` (bundle, then pre-render the site
  into `dist/`—home, CV and blog index per language, one page per article, relay
  pages for the old URLs, plus `404.html`; runs `tsgo --noEmit` concurrently and
  gates on it).
- `bun run preview` → build, then serve `dist/` on http://localhost:4173 with
  the real URLs ([scripts/preview.ts](scripts/preview.ts);
  `PORT=8080 bun run
  preview` to change the port). The way to see an article
  at its deployed path; `bun run dev` does not know the blog URLs.
- `bun run check` → `tsgo --noEmit`, the type gate. `bun test` → unit tests.
- `bun run fonts:update` → `bun scripts/update-fonts.ts`, which re-subsets the
  vendored Noto `.woff2` files from the Google Fonts `&text=` endpoint. It asks
  in **batches of 600 glyphs**, and that number is the whole point: measured on
  2026-08-10, 800 glyphs still return one face carrying exactly those glyphs,
  while 900 return 101 faces—the endpoint has stopped subsetting and is serving
  the complete font split by unicode range, 13.5 MB across SC, TC and HK. A
  family therefore spans several files (7 today, 1.1 MB), each with its own
  `unicode-range`, so the browser still fetches only what a page needs. Run it
  after changing copy in [src/translations.ts](src/translations.ts), the render
  modules, or any article. **You will rarely need to remember**: the build
  itself refuses to emit a `dist/` whose subsets do not cover the pages, and
  names the missing glyphs. It checks offline rather than refetching— putting
  Google on the critical path of every deploy would make two builds of one
  commit produce different bytes.
- `bun run og:update` → `bun scripts/og-image.ts`, which re-renders
  `public/og-image.png` (the 1200×630 link preview) from the English hero and
  the light palette, using local Chrome. The build only copies the file, so run
  this after changing the English hero and commit the PNG.

### Generated Files

- **Link previews.** `bun scripts/social-meta.ts dist/index.html …` prints the
  preview a scraper would build from a page. The same HTMLRewriter extraction
  backs the social-card assertions in
  [scripts/build.test.ts](scripts/build.test.ts), so the tags the build writes
  are checked by something that reads them the way their consumers do.
- **Sitemap.** `bun scripts/sitemap.ts dist/sitemap.xml` reads a sitemap back
  the same way. [scripts/sitemap.ts](scripts/sitemap.ts) also **writes** it (the
  build imports it under `SITE_URL`); its header records which protocol fields
  are emitted and why the other two are not—read it before adding one.
  `<lastmod>` comes from `git log` over the paths that reach a visitor, so **all
  three workflows** check out with `fetch-depth: 0`. Without history the field
  is omitted rather than guessed, and the assertions in
  [scripts/build.test.ts](scripts/build.test.ts) that compare the build to that
  same lookup would pass on empty against empty. That is why the gates need the
  history too, not just the deploy.
- **Sitemap stylesheet.** [scripts/sitemap-style.ts](scripts/sitemap-style.ts)
  writes the CSS the sitemap names in its `<?xml-stylesheet?>` instruction
  (`bun scripts/sitemap-style.ts` prints it; `xmllint` is how it gets checked,
  and it is not a repo dependency). Both files ship together or not at all.
  There used to be an XSLT 1.0 half drawing a table; it was deleted rather than
  kept to its end date—Chrome removes XSLT in 158, and it had already fallen out
  of step with the site, reading each page's language from a file name the move
  to per-language folders had made meaningless. Do not bring it back. What CSS
  cannot do is the whole cost: it cannot create a link, and no selector can read
  element text, so the URLs are inert and there is no language column.
- **Feeds.** [scripts/feed.ts](scripts/feed.ts) writes one JSON Feed 1.1 per
  language, also `SITE_URL`-gated. Same rule as the sitemap, and the same header
  convention: every field is justified there, and **no date is ever
  synthesized**. The items are the language’s articles: `date_published` is the
  frontmatter `date` (explicit, author-chosen—no git lookup, nothing a shallow
  clone can empty), `date_modified` the optional `updated`.
- **Relay pages.** [scripts/relay.ts](scripts/relay.ts) keeps the pre-blog URLs
  alive (`fr.html` → `fr/`, `en.html` → the root): canonical, zero-second
  refresh, `noindex`. Retire them once the old URLs have aged out.

### Writing an article

- Create `content/posts/<slug>/<lang>.md`: the folder name IS the slug
  (`[a-z0-9-]`, reserved names refused by [src/urls.ts](src/urls.ts)), the file
  name IS the language. An article exists in 1..n languages; an index lists only
  what exists in it. `zh-hk` needs no file—writing `zh-hant.md` is enough, the
  projection derives it; an explicit `zh-hk.md` wins.
- Frontmatter is a strict micro-grammar (`title`, `date` required; `summary`,
  `tags`, `draft`, `updated` optional)—no YAML, and every refusal names the file
  ([scripts/frontmatter.ts](scripts/frontmatter.ts)). A `draft: true` is
  excluded unless `DRAFTS=1`.
- Raw HTML in a source is refused by the build’s allowlist guard
  ([scripts/markdown.ts](scripts/markdown.ts)): GFM only.
- After writing: `bun run fonts:update` (new glyphs), then `bun run preview` to
  read it at its real URL.

## 3. Code Style

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
the code itself.

## 4. Language and Syntax: Stay Erasable

Bun (and Node’s native type-stripping) executes TypeScript by **erasing types**,
not transforming syntax. Keep the source erasable so it runs anywhere and stays
bundler-agnostic:

- **No `enum`.** Use a frozen object plus a derived union—the pattern already
  used by `LANGS`/`Lang` in [src/translations.ts](src/translations.ts):
  ```ts
  export const LANGS = ["en", "fr", "zh", "zh-hant"] as const;
  export type Lang = (typeof LANGS)[number];
  ```
- **No `namespace`**, no `import =` aliases, no class **parameter properties**
  (`constructor(private x)`). These emit runtime code and break type-stripping.
- **ESM only**, with explicit type-only imports:
  `import { type Lang } from './translations'`. This lets the stripper or
  bundler drop them with certainty (see `verbatimModuleSyntax` in §6).

## 5. Type Modeling: Guide Inference, Don’t Fight It

- **`satisfies`, not `as`.** Validate a value against a type while keeping its
  precise literal inference. `as` is a lie to the compiler—reserve it for real
  escape hatches (DOM casts, untyped libraries). Prefer:
  ```ts
  const routes = { home: { method: "GET" } } satisfies Record<string, Route>;
  ```
- **`unknown`, never `any`.** At the only real boundary here—`localStorage`
  (theme in [src/main.ts](src/main.ts))—read defensively and narrow, never
  assume. There is no network or user-data ingestion, so no runtime schema
  validator (Zod) is warranted; if that changes, validate external data at the
  boundary before it enters the app.
- **Let inference work.** Annotate function signatures and module boundaries;
  don’t annotate every local. Avoid unreadable conditional-type gymnastics.
- **`NoInfer<T>`** when a secondary generic argument must not widen the inferred
  type (relevant for small generic helpers such as `debounce` in `measure.ts`).

## 6. `tsconfig`: The Safety Contract

The current config is `strict` with `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch`, and `moduleResolution: "bundler"`, **plus** the
five flags below. They are enabled; keep them on, because each catches a real
class of bug.

- **`noUncheckedIndexedAccess`**—array and record access returns
  `T | undefined`. This code indexes `translations[lang]`, `nav[id]`, and
  `lines[i]`, so the flag forces the guards that prevent runtime `undefined`
  surprises. The one sanctioned escape is a `!` on an index the surrounding loop
  has already bounded (`items[i]!` inside `for (i < items.length)`, throughout
  [src/linebreak.ts](src/linebreak.ts)): the guard would be unreachable, and the
  Knuth–Plass inner loops run per line per resize, so a branch that can never be
  taken is noise in the hot path. Everywhere else—anything indexed by a value
  from the DOM, the URL, or a lookup that can legitimately miss—narrow it or
  throw a named error, as `distFontUrl` does in
  [scripts/build.ts](scripts/build.ts).
- **`exactOptionalPropertyTypes`**—distinguishes “key absent” from “key set to
  undefined” (it matters for the optional fields in `FitFont` and the fit
  options in `measure.ts`).
- **`verbatimModuleSyntax`**—forces explicit `import type`, guaranteeing clean
  erasure under Bun.
- **`erasableSyntaxOnly`**—bans runtime TS syntax (enums, namespaces, parameter
  properties). Bun executes these files by _stripping_ types, so anything
  non-erasable would silently change runtime behavior; this makes it a type
  error.
- **`noUncheckedSideEffectImports`**—side-effect imports
  (`import "./styles.css"`) must resolve to a declared module (see
  [src/globals.d.ts](src/globals.d.ts)) instead of being silently ignored when
  the path is wrong.

`include` covers both `src/` and `scripts/` (the build and font scripts are
typed against `@types/bun`). Keep `target` on an evergreen baseline (ES2022 or
later); this site targets modern browsers only, so don’t down-level.

## 7. Tooling and Quality Gates

- **Type checking is the gate.** `tsgo --noEmit` runs in `build` and in CI. Keep
  it green. The checker is TypeScript 7 (`@typescript/native-preview`, the
  native Go compiler—near-instant, and its semantics match 6.x). VS Code uses it
  too, via `js/ts.experimental.useTsgo` in
  [.vscode/settings.json](.vscode/settings.json).
- Read deno.com/agents.md and set up Deno in this project.
- **Formatting and linting are Deno’s, and they are separate concerns.** At the
  end of a change, run `deno fmt` and then `deno lint` from the repo root. There
  is no Deno config file here on purpose: both commands run on their defaults,
  and adding a config would be one more thing to keep in step. `deno fmt` owns
  formatting, Markdown included—never undo its wrapping by hand—and it never
  splits the long `unicode-range` strings in [src/fonts.ts](src/fonts.ts).
  `deno lint` only reads. Never run a formatter _through_ a linter.
- **No dead tooling.** Dependencies are deliberately minimal: two dev
  dependencies (`@typescript/native-preview`, `@types/bun`) and two runtime
  ones, `@chenglou/pretext` (measurement) and `hyphen` (Liang hyphenation
  patterns, `import()`ed per language). Don’t add build tools that Bun already
  covers (bundling, CSS, TS, dev server).

## 8. Measurement with pretext

- **Prepare once, then do arithmetic.** `prepareWithSegments` is the expensive
  pass—cache it (see `widthPerPxCache` in `measure.ts`). On resize or language
  change, only re-run the cheap width and layout math; never re-prepare
  identical text.
- **A named font is required.** pretext is inaccurate with `system-ui`, so the
  site self-hosts four families—**Noto Sans / Noto Sans SC / Noto Sans TC / Noto
  Sans HK** ([src/fonts.ts](src/fonts.ts))—and every measurement waits for
  `document.fonts.ready`. A family may span several files: see `fonts:update` in
  §2 for why, and never assume one family means one face.
- **Fonts are imported, not CSS-`url()`’d.** Bun inlines CSS-referenced fonts as
  base64; importing the `.woff2` (file loader) emits a separate hashed asset and
  keeps `unicode-range` lazy-loading, so an EN visitor never fetches the CJK
  subset. The subset files are vendored—regenerate them only when the glyph set
  changes.
- **Keep a safety margin** (`MEASURE_SAFETY`) on every fit, so rounding never
  causes overflow or clipping.
- **The nav bar has no responsive slack.** It shares `--wrap` with the content,
  so `.nav__links` gets the same ~354px whether the window is 900 or 1728px
  wide—widening the viewport is never the fix for a nav label that overruns.
  `fitNavLinks` spends the gap down to `minGapPx` before it touches the type,
  because 0.8125rem is already the smallest step in the ramp. Watch the budget
  when a translation changes: `auditNavLinks` reports it for every language from
  any page (the brand is 112px in Latin but 161px in Chinese, so the budget is
  not one number), and `.nav__links { overflow: hidden }` is the floor under it
  for a visitor whose JS never runs.
- **A fitter’s answer is pre-stated in CSS, or it flashes.** The fitters run
  after `document.fonts.ready`, so whatever [src/styles.css](src/styles.css)
  declares is what the visitor sees first—on load, and again for the ~30 ms
  after a language switch replaces `#app`. When the two disagree, the size snaps
  in front of the reader, which is how the hero shipped at 88px and settled at
  76 for months. So `.hero__name` carries the fit as a `clamp`, and the three
  overrunning languages carry `fitNavLinks`’ own output, `column-gap` included
  (bake the type without the gap and the row is still 40px off). Two rules hold
  it together: the bounds are **px**, because `HERO_FIT` and `NAV_FIT` are px
  and `rem` would drift from them under a changed root font size; and every
  number that is not measured is asserted against its constant in
  [src/styles.test.ts](src/styles.test.ts). Only the width of the rendered text
  needs a browser—re-measure it when the name or the display font changes.
- **Knuth–Plass.** [src/linebreak.ts](src/linebreak.ts) runs optimal, TeX-style
  line breaking over pretext-measured boxes and glue, with `hyphen` supplying
  syllable break points, to justify the About paragraphs and the articles. Glue
  uses `shrink: 0` because CSS `text-align: justify` can only stretch spaces,
  never shrink them. Keep that invariant, and keep the small target-width
  margin, or lines will wrap. The paragraph arrives as styled **runs**
  (`Run[]`), each box measured in its own font—a bold or monospace span is wider
  than prose (+1.5%/+8.1% measured), and flat measurement overflows the computed
  line. A run with `extraWidth` (inline code's padding/borders) is atomic: never
  split, never hyphenated, charged its full width. Chinese pages get no
  Knuth–Plass (no patterns, native justify is already near-optimal).
- **Rich runs in the DOM.** [src/richtext.ts](src/richtext.ts) reads a
  paragraph's runs from its text nodes (`runsFrom`, DOM half) and rebuilds it as
  one `.kp-line` span per line with each run's inline chain reopened
  (`buildLinesHtml`, pure half—unit-tested without a document). Composition is
  scheduled by an `IntersectionObserver` with one screen of `rootMargin`, so a
  40-paragraph article typesets just before each paragraph scrolls into view
  (measured CLS: 0); a resize recomposes only paragraphs already composed.
  Measured limitation, shared with the About path since the beginning:
  find-in-page does not match a phrase spanning a computed line break, because
  the spans are block-level.

## 9. Rendering and Enhancement

- **The enhancement inventory.** Each one runs after paint, and none is
  load-bearing: pretext-measured fitting of the hero name, the section titles,
  and the nav shortcuts ([src/measure.ts](src/measure.ts)); Knuth–Plass
  re-typesetting of the About paragraphs and article bodies
  ([src/linebreak.ts](src/linebreak.ts) + [src/richtext.ts](src/richtext.ts));
  tight-wrapped chat bubbles ([src/chat.ts](src/chat.ts)); reveal-on-scroll with
  stat counters; the theme toggle; and reload-free language switching (CV page
  only—the blog pages navigate). If any one fails, the pre-rendered content
  stays on screen—write them so a failure is a no-op, never a blank.
- **Language negotiation runs at the root only, and it redirects.** `index.html`
  carries an inline `<head>` script (generated by `languageNegotiationScript` in
  [src/render.ts](src/render.ts), injected by
  [scripts/build.ts](scripts/build.ts)) that sends a visitor to the page in
  their language. Three rules hold it together, and each one is load-bearing. A
  URL that **names** a language is never redirected, or shared links would
  change language on the recipient—which is why the script is never injected
  into anything but the English home at the site root
  ([scripts/build.ts](scripts/build.ts) tests
  `ref.kind === "home" && lang ===
  "en"`), rather than injected everywhere
  behind a runtime path check. It uses `location.replace`, so the root never
  becomes a history entry and Back is not trapped in a redirect loop. And a
  hand-picked language (localStorage `cv-lang`, written only on an explicit
  switcher click, never on popstate) outranks the browser list. The matching
  rule lives **once**, as ES5 inside that generated script, because it has to
  run before the bundle exists; resist adding a “proper” TypeScript twin, since
  the script is its only caller and a second copy would just be one more thing
  to keep in step. The test in [src/render.test.ts](src/render.test.ts) executes
  that shipped source against a stubbed browser instead.
- **Measure only after `document.fonts.ready`.** Every pretext call goes through
  `whenFontsReady` and uses the page’s _live_ font stack
  (`getComputedStyle(document.body).fontFamily`), so CJK pages measure with the
  family they actually render in. Measuring against a fallback silently produces
  wrong widths.
- **Re-render wipes the DOM.** A language switch replaces `#app` innerHTML, so
  no enhancement may hold a reference across it: controllers re-query on every
  `afterPaint`, and async work re-checks
  `lang !== currentLang || !el.isConnected` before touching the DOM it started
  from (see `justifyParagraph`).
- **Hydration over re-render.** On first load, `renderApp` output already equals
  the pre-rendered markup, so `init` binds events instead of rebuilding. Keep
  the two byte-identical, or first paint will flash.
- **Color discipline.** One neutral ramp plus a single accent, the system blue
  (`#0071e3` light, `#0a84ff` dark, in [src/styles.css](src/styles.css)).
  Interactive states use that accent, hairline borders, or fg/bg inversion.
  Don’t introduce a second hue.
- **Dev-only code is feature-gated.** `feature("PROD")` from `bun:bundle` (the
  production build passes `features: ["PROD"]`) compiles the title audit down to
  `if (false)` and tree-shakes it out. Use the same gate for any new diagnostic,
  rather than a `NODE_ENV` check.
- **Print is a real target, narrowly.** A CV gets printed, and the reveal system
  is scroll-driven: without the `@media print` block in
  [src/styles.css](src/styles.css), every `.animate` section below the fold
  prints at `opacity: 0`—blank pages. That block does four things and should not
  grow past them: force the reveals visible; hide chrome that means nothing on
  paper (nav, skip link, hero actions, copy button); let the hero size to its
  content; and keep events and cards whole across page breaks. The dark palette
  is scoped to `@media screen` for the same reason.

## 10. `experiments/`: A Slot, Currently Empty

There is no `experiments/` directory today. The convention is kept because the
directory is meant to come and go: it holds **open questions**, not history, and
is deleted the moment one is resolved.

If you create it again, it is **not** a scratch directory. Nothing lands there
unless it is typechecked, tested, and carries a `README.md` stating what it
proves and what adoption would cost. Add `experiments/**/*.ts` back to the
tsconfig `include` so it sits inside the gates: an experiment that cannot
survive `bun run check` is not kept, because a rotting prototype reads as a
working option. Nothing in `src/` may import it—the arrow points one way, and
adopting one means moving the code into `src/`, not adding an import. Where an
experiment forks a shipping module, assert with an **equivalence test over every
input the original accepts** that the fork still matches it; a prose claim of
equivalence is what lets a fork drift.

Ruled out so far, so that it is not rediscovered:

- **rich-linebreak** (removed July 27, 2026, **adopted August 9, 2026**)—the
  run-aware Knuth–Plass fork. The blog gave it its use case: an article
  paragraph carries `em`/`strong`/`code`/`a`, which the flat breaker both
  mis-measured (+8.1% for a monospace span, against the 6px margin) and erased.
  The adoption merged the contract INTO the shipping module rather than beside
  it: `src/linebreak.ts` takes `Run[]` and returns fragments, the flat contract
  survives as the `breakIntoLinesFlat` shim, and the equivalence test exercises
  every hyphenated language (the fork's drift lesson: its own test only ever ran
  `"en"`). Its other proof stands: `@chenglou/pretext/rich-inline` is a greedy
  breaker, and trading the optimal one away for rich text was never an option.
