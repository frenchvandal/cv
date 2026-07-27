/*
 * The chrome of the phone the Dialogue section is drawn inside: status bar
 * glyphs, the two navigation chevrons, and the composer's controls.
 *
 * Drawn here rather than vendored as files (the way [src/logos.ts](src/logos.ts)
 * carries the school marks): these are a handful of primitives — bars, arcs, a
 * rounded rect — small enough that the path data *is* the drawing, and a file
 * per glyph would hide seven twenty-byte shapes behind seven imports. They
 * follow the same two rules the logos do: one flat `currentColor` so light and
 * dark need no second asset, and a viewBox tight to the ink so the CSS sizes
 * them by height alone.
 *
 * Every glyph is decorative — the thread carries the meaning, and the frame is
 * hidden from assistive tech at the container (see `dialogue` in
 * [src/render.ts](src/render.ts)), so none of them needs a title.
 */

/** Cellular strength: four bars, the iOS ramp. */
export const ICON_SIGNAL =
  `<svg class="phone__ico" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.6" width="3" height="6.4" rx="1"/><rect x="10" y="2.8" width="3" height="9.2" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>`;

/** Wi-Fi: three arcs off one centre, the innermost standing in for the dot. */
export const ICON_WIFI =
  `<svg class="phone__ico" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M1.2 4.1a9.6 9.6 0 0 1 13.6 0"/><path d="M3.9 6.9a5.8 5.8 0 0 1 8.2 0"/><path d="M6.6 9.6a2 2 0 0 1 2.8 0"/></svg>`;

/**
 * Battery: shell, fill and cap. The shell and cap are dimmed rather than drawn
 * in a second colour — the palette here is one neutral plus the accent.
 */
export const ICON_BATTERY =
  `<svg class="phone__ico phone__ico--battery" viewBox="0 0 25 12" aria-hidden="true"><rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4"/><rect x="2.2" y="2.2" width="15" height="7.6" rx="2" fill="currentColor"/><path d="M23.2 4.4a2.2 2.2 0 0 1 0 3.2Z" fill="currentColor" opacity="0.4"/></svg>`;

/** Back chevron of the conversation bar (tinted with the accent, like iOS). */
export const ICON_CHEVRON_LEFT =
  `<svg class="phone__chevron" viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2 2 10l8 8"/></svg>`;

/** The disclosure chevron under the contact name. */
export const ICON_CHEVRON_RIGHT =
  `<svg class="phone__disclosure" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 2 4 5-4 5"/></svg>`;

/** Composer: the attachments control. */
export const ICON_PLUS =
  `<svg class="phone__ico phone__ico--plus" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.16"/><path d="M12 7.2v9.6M7.2 12h9.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/** Composer: dictation, the control that sits in an empty field. */
export const ICON_MIC =
  `<svg class="phone__ico phone__ico--mic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.6" width="6" height="11" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v3.6"/></svg>`;
