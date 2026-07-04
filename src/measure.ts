/*
 * Measurement layer, powered by @chenglou/pretext.
 *
 * pretext measures text with the browser's font engine (canvas) WITHOUT touching
 * the DOM, so there is no layout reflow. We use it for two real, multilingual
 * fit problems that plain CSS `clamp()` only approximates:
 *
 *   1. fitHeroName  — scale the hero name so its widest line fills the width.
 *   2. fitSectionTitles — size the sticky section titles so the longest one fits
 *      its column at every language, instead of being truncated with an ellipsis.
 *
 * The site renders with self-hosted Noto Sans / Noto Sans SC — named fonts, which
 * pretext requires for accuracy (system-ui is explicitly unsafe). Measurement
 * waits for `document.fonts.ready` so it runs against the real glyphs, and each
 * fit keeps a small safety margin (MEASURE_SAFETY) as insurance against sub-pixel
 * rounding: the hero name lands a hair inside the edge, titles shrink a touch
 * early rather than clipping.
 */

import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";

/** Font size, in px, at which widths are measured before being scaled. */
const REFERENCE_PX = 100;

/** Fraction we shrink every fit by, as insurance against rounding — invisible, never overflows. */
const MEASURE_SAFETY = 0.98;

/** Mirrors the CSS `--font` stack so canvas falls back like the DOM. */
const FONT_STACK =
  "'Noto Sans', 'Noto Sans SC', system-ui, -apple-system, sans-serif";

export interface FitFont {
  weight: number;
  /** CSS `letter-spacing` in em (scales with font size). */
  letterSpacingEm: number;
  family?: string;
  style?: string;
}

/**
 * Width of `text` per 1px of font size, for the given font. Cached: pretext's
 * `prepare` pass is the expensive part, so we never repeat it for the same
 * (text, font) — exactly what the library asks for.
 */
const widthPerPxCache = new Map<string, number>();

function widthPerPx(text: string, font: FitFont): number {
  const family = font.family ?? FONT_STACK;
  const style = font.style ?? "normal";
  const key =
    `${style}|${font.weight}|${font.letterSpacingEm}|${family}|${text}`;
  const cached = widthPerPxCache.get(key);
  if (cached !== undefined) return cached;

  const spec = `${style} ${font.weight} ${REFERENCE_PX}px ${family}`;
  const prepared = prepareWithSegments(text, spec, {
    letterSpacing: font.letterSpacingEm * REFERENCE_PX,
    wordBreak: "keep-all",
  });
  const perPx = measureNaturalWidth(prepared) / REFERENCE_PX;
  widthPerPxCache.set(key, perPx);
  return perPx;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rootFontSize(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

export interface FitHeroOptions extends FitFont {
  minPx?: number;
  maxPx?: number;
  /** Fraction of the available width the name should occupy. */
  fill?: number;
}

/**
 * Sizes `nameEl` so its widest child line fills the available width. The element
 * is a block, so `clientWidth` tracks the container (not its nowrap text) and
 * never feeds back into the size we set — no measurement loop.
 */
export function fitHeroName(
  nameEl: HTMLElement,
  options: FitHeroOptions,
): void {
  const lines = Array.from(nameEl.children, (el) => el.textContent ?? "")
    .filter(Boolean);
  if (lines.length === 0) return;

  const widest = Math.max(...lines.map((line) => widthPerPx(line, options)));
  if (widest <= 0) return;

  const available = nameEl.clientWidth;
  if (available <= 0) return;

  const fill = (options.fill ?? 1) * MEASURE_SAFETY;
  const size = clamp(
    (available * fill) / widest,
    options.minPx ?? 32,
    options.maxPx ?? 160,
  );
  nameEl.style.fontSize = `${size}px`;
}

export interface FitTitlesOptions extends FitFont {
  minPx?: number;
  maxPx?: number;
  /** Column width the titles must fit within, in rem. */
  columnRem: number;
  /** Only fit at or above this viewport width (rem); below it, titles wrap. */
  desktopMinRem: number;
  /** Extract the measurable label from a title element (its index span is skipped). */
  label: (el: HTMLElement) => string;
}

/**
 * Gives every section title one uniform size: the largest size (capped at
 * `maxPx`) at which the *longest* title still fits the column. Prevents the
 * ellipsis truncation the CSS falls back to, and keeps titles visually
 * consistent as you scroll — across all three languages. On narrow viewports
 * the titles wrap normally, so any inline size is cleared.
 */
export function fitSectionTitles(
  titleEls: HTMLElement[],
  options: FitTitlesOptions,
): void {
  const rem = rootFontSize();

  if (globalThis.innerWidth < options.desktopMinRem * rem) {
    for (const el of titleEls) el.style.removeProperty("font-size");
    return;
  }

  const target = options.columnRem * rem * MEASURE_SAFETY;
  const maxPx = options.maxPx ?? 72;
  const minPx = options.minPx ?? 28;

  let common = maxPx;
  for (const el of titleEls) {
    const perPx = widthPerPx(options.label(el), options);
    if (perPx <= 0) continue;
    common = Math.min(common, target / perPx);
  }
  common = clamp(common, minPx, maxPx);

  for (const el of titleEls) el.style.fontSize = `${common}px`;
}

/** Resolves once web fonts are loaded, so measurement uses the real glyphs. */
export function whenFontsReady(callback: () => void): void {
  const fonts = document.fonts;
  if (fonts && typeof fonts.ready?.then === "function") {
    fonts.ready.then(callback);
  } else {
    callback();
  }
}

/** Trailing debounce, used for resize-driven re-fits. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export interface AuditEntry {
  lang: string;
  label: string;
  requiredPx: number;
  maxPx: number;
  fitsAtMax: boolean;
}

/**
 * Dev-only, pretext-powered QA: without switching languages or touching the DOM,
 * report any section title that cannot render at `maxPx` within its column in
 * EN / FR / ZH — i.e. that the fitter must shrink. Catches a localized label
 * that would otherwise overflow, browser-tab-free.
 */
export function auditSectionTitles(
  labelsByLang: Record<string, string[]>,
  options: { columnRem: number; maxPx: number } & FitFont,
): AuditEntry[] {
  const target = options.columnRem * rootFontSize() * MEASURE_SAFETY;
  const entries: AuditEntry[] = [];

  for (const [lang, labels] of Object.entries(labelsByLang)) {
    for (const label of labels) {
      const perPx = widthPerPx(label, options);
      const requiredPx = perPx > 0 ? target / perPx : options.maxPx;
      entries.push({
        lang,
        label,
        requiredPx: Math.round(requiredPx),
        maxPx: options.maxPx,
        fitsAtMax: requiredPx >= options.maxPx,
      });
    }
  }
  return entries;
}
