/*
 * App-level constants shared between the runtime ([src/main.ts](src/main.ts))
 * and the static build ([scripts/build.ts](scripts/build.ts)), or repeated as a
 * contract inside one of them.
 *
 * Deliberately small: tuning constants stay next to the code they tune, and
 * purely visual values live in [src/styles.css](src/styles.css) — JS reads
 * those from the computed styles (custom properties, the `.msg` max-width)
 * instead of keeping a copy here.
 */

/**
 * Browser-chrome color per theme (`<meta name="theme-color">`, the 404 page).
 * Mirrors `--bg` in [src/styles.css](src/styles.css); the runtime reads the
 * live custom property first and falls back to these only when the stylesheet
 * hasn't applied.
 */
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
 * Language-switch timing: [src/main.ts](src/main.ts) swaps the DOM this long
 * after arming the fade — just before the 250ms `#app` opacity transition in
 * [src/styles.css](src/styles.css) completes, so the fade-in already runs on
 * the new content. Keep the two in sync.
 */
export const PAGE_SWAP_MS = 220;
