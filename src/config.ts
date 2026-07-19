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
 * (weight 800, -0.03em tracking).
 */
export const DISPLAY_FONT = { weight: 800, letterSpacingEm: -0.03 } as const;

/**
 * Section-title fitting contract, shared by the live fitter and the dev-only
 * audit. `columnRem` mirrors the `fit-content(26rem)` title column of the CSS
 * `.section` grid; `desktopMinRem` its single-column breakpoint.
 */
export const TITLE_FIT = {
  columnRem: 26,
  maxPx: 72,
  minPx: 28,
  desktopMinRem: 56,
} as const;

/**
 * Language-switch timing: [src/main.ts](src/main.ts) swaps the DOM this long
 * after arming the fade — just before the 250ms `#app` opacity transition in
 * [src/styles.css](src/styles.css) completes, so the fade-in already runs on
 * the new content. Keep the two in sync.
 */
export const PAGE_SWAP_MS = 220;
