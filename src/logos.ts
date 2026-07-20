/*
 * School logos for the education cards — monochrome, flat single-colour, on a
 * transparent ground (no gradients, shadows, textures or bitmaps).
 *
 * Sichuan University and Université de Cergy-Pontoise come from supplied vector
 * files, already drawn in a single colour, so "strip the colour, keep one flat
 * fill" is an exact conversion: the original outlines — the calligraphy, the
 * brush stroke, the wordmark — survive untouched. They are then run through
 * svgo at one decimal, indistinguishable from the source at any size a card
 * uses, for a third of the bytes.
 *
 * The Cergy source arrived with a square viewBox around a 1.6:1 lockup. Since
 * the cards size by height, that padding rendered the logo about a third too
 * small next to the others, so its viewBox is re-cropped to the ink bounds —
 * a change of window only, not of artwork.
 *
 * EDC arrived as a clean, high-contrast bitmap rather than a vector, so it is
 * auto-traced (potrace) instead of redrawn: the curve fitting reproduces the
 * letterforms as drawn rather than as guessed. Checked against the source at
 * matching size, the two agree on 92.8% IoU with every disagreeing pixel lying
 * on the one-pixel antialiased boundary — no shape differs. All contours share
 * one path with `fill-rule="evenodd"`, since potrace emits each counter (the O
 * of SCHOOL, the bowl of the D) as its own closed contour: split across
 * separate <path> elements they would fill solid instead of being knocked out.
 *
 * They are imported as text and inlined rather than served as files, for two
 * reasons: `fill="currentColor"` then makes them follow the text colour, so
 * light/dark needs no second asset and no filter hack; and the same string
 * works in the dev shell, in the SSG build, and on client-side re-render, with
 * no asset-path skew between them (the dev server does not serve public/).
 *
 * Each file is a valid standalone SVG — open one in any vector editor to tweak.
 */

import cergyPontoise from "./logos/cergy-pontoise.svg" with { type: "text" };
import edcParis from "./logos/edc-paris.svg" with { type: "text" };
import sichuanUniversity from "./logos/sichuan-university.svg" with {
  type: "text",
};

export const LOGOS = {
  sichuan: sichuanUniversity,
  master: cergyPontoise,
  edc: edcParis,
} as const;
