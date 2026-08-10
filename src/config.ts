/*
 * App-level constants shared between the runtime ([src/main.ts](src/main.ts))
 * and the static build ([scripts/build.ts](scripts/build.ts)), or repeated as a
 * contract inside one of them.
 *
 * Deliberately small: tuning constants stay next to the code they tune, and
 * purely visual values live in [src/styles.css](src/styles.css)—JS reads
 * those from the computed styles (custom properties, the `.msg` max-width)
 * instead of keeping a copy here.
 */

/**
 * Browser-chrome color per theme (`<meta name="theme-color">`, the 404 page).
 * Mirrors `--bg` in [src/styles.css](src/styles.css); the runtime reads the
 * live custom property first and falls back to these only when the stylesheet
 * hasn’t applied.
 */
import type { Lang } from "./translations.ts";

export const THEME_COLOR = {
  dark: "#000000",
  light: "#ffffff",
} as const;

/**
 * Font descriptor for the display type pretext measures (hero name, section
 * titles). Must match the CSS `.hero__name` / `.section__title` rules
 * (weight 600, -0.02em tracking).
 */
export const DISPLAY_FONT = { weight: 600, letterSpacingEm: -0.02 } as const;

/**
 * Hero-name fitting contract. The name scales with the column, but `maxPx`
 * caps it well below the width it *could* fill: at full width it would be the
 * loudest thing on the page, which is exactly what the sober direction is
 * not. `fill` leaves air on both sides so the name never touches the edge.
 */
export const HERO_FIT = {
  maxPx: 76,
  minPx: 34,
  fill: 0.92,
} as const;

/**
 * Section-title fitting contract, shared by the live fitter and the dev-only
 * audit. `columnRem` is the width a title may occupy inside the `--wrap`
 * content column of [src/styles.css](src/styles.css): 48.5rem less its 2.5rem
 * of padding leaves 46rem, less a 2rem margin for the longest localized label.
 * `desktopMinRem` mirrors the breakpoint below which titles wrap instead of
 * being fitted.
 */
export const TITLE_FIT = {
  columnRem: 44,
  maxPx: 44,
  minPx: 24,
  desktopMinRem: 56,
} as const;

/**
 * Font descriptor for the nav-bar shortcuts. Must match `.nav__link` in
 * [src/styles.css](src/styles.css): the body weight, and no tracking of its own.
 */
export const NAV_FONT = { weight: 400, letterSpacingEm: 0 } as const;

/**
 * Nav-shortcut fitting contract. Unlike the hero and the section titles, this
 * one has no responsive slack to play with: the bar shares `--wrap` with the
 * content, so `.nav__links` gets the same ~354px at every viewport—the window
 * can be 1728px wide and the budget does not move. Five labels at `maxPx` fit
 * that in English and Chinese with room to spare, and overrun it by 34–57px in
 * Portuguese, French and Spanish.
 *
 * The fitter therefore spends the gap first, down to `minGapPx`: whitespace
 * between shortcuts is the cheapest width on the bar. Only then does it touch
 * the type, and `minPx` stops one step below `maxPx`—0.8125rem is already the
 * smallest size in the ramp, so anything under 12px is a new, lonelier step.
 *
 * `maxPx` mirrors `.nav__link`’s font-size and `maxGapPx` the `--space-md` gap;
 * `desktopMinRem` mirrors the breakpoint below which the shortcuts are hidden
 * outright. Keep the four in sync with [src/styles.css](src/styles.css).
 */
export const NAV_FIT = {
  maxPx: 13,
  minPx: 12,
  maxGapPx: 20,
  minGapPx: 10,
  desktopMinRem: 56,
} as const;

/**
 * The Dialogue phone’s screen width, in px, and the range its control offers.
 *
 * `initial` is the pretext demo’s own 340px, and the bounds stay inside what a
 * real handset measures—an iPhone SE is 320pt across, a Pro Max 430—so the
 * frame reads as a phone at either end of the slider rather than as a box that
 * happens to hold bubbles. `.phone` in [src/styles.css](src/styles.css) carries
 * `initial` as the CSS default, for every visitor whose JS never runs.
 */
export const CHAT_WIDTH = {
  min: 280,
  max: 420,
  initial: 340,
} as const;

/**
 * Language-switch timing: [src/main.ts](src/main.ts) swaps the DOM this long
 * after arming the fade—just before the 250ms `#app` opacity transition in
 * [src/styles.css](src/styles.css) completes, so the fade-in already runs on
 * the new content. Keep the two in sync.
 */
export const PAGE_SWAP_MS = 220;

/**
 * The CJK family each language names in its `--font` stack
 * ([src/styles.css](src/styles.css)).
 *
 * Three places have to agree on this map and none of them can see the other
 * two: the stylesheet that names the family, the build that emits the matching
 * `@font-face`, and the runtime that has to add one when the CV changes
 * language in place. It lives here so the agreement is a shared constant
 * rather than three copies, and [src/styles.test.ts](src/styles.test.ts) holds
 * the stylesheet to it.
 *
 * The Latin scripts do NOT name Noto Sans SC: they name the small subset
 * carrying the twenty Chinese characters they actually render. Naming SC there
 * cost an English reader 342 KB of font, measured.
 */
export const INLINE_CJK_FAMILY = "Noto Sans CJK Inline";

export const CJK_FAMILY = {
  en: INLINE_CJK_FAMILY,
  fr: INLINE_CJK_FAMILY,
  pt: INLINE_CJK_FAMILY,
  es: INLINE_CJK_FAMILY,
  zh: "Noto Sans SC",
  "zh-hant": "Noto Sans TC",
  "zh-hk": "Noto Sans HK",
} as const satisfies Record<Lang, string>;
