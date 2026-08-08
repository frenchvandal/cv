/*
 * The Hong Kong page is a projection of the Taiwan one, not a translation of
 * its own (see HK_LEXICON in translations.ts). A projection can rot in two
 * silent ways—a term that survives the swap, and two nested terms applied in
 * the wrong order—and neither would fail the type checker, since both pages
 * have the same shape by construction. These tests are what stands in for the
 * review a hand-written translation would get.
 *
 * The lexicon is broader than the CV on purpose (it also projects the blog's
 * articles), so a term absent from the CV is no longer a defect: only the
 * terms the Taiwan page actually uses can be checked end to end.
 */

import { expect, test } from "bun:test";
import { HK_TERMS, translations } from "./translations.ts";

const taiwan = JSON.stringify(translations["zh-hant"]);
const hongKong = JSON.stringify(translations["zh-hk"]);

test.each([...HK_TERMS])(
  "no Taiwan term survives on the Hong Kong page (%s → %s)",
  (twTerm) => {
    expect(hongKong).not.toContain(twTerm);
  },
);

test.each([...HK_TERMS])(
  "a term the Taiwan page uses is swapped on the Hong Kong page (%s → %s)",
  (twTerm, hkTerm) => {
    if (!taiwan.includes(twTerm)) return;
    expect(hongKong).toContain(hkTerm);
  },
);

test("a term nested in another is projected after it", () => {
  // 網路 is a substring of 網際網路: applied first, it would half-rewrite the
  // longer term into 網際網絡. Object key order is application order, so no
  // later key may contain an earlier one.
  const keys = HK_TERMS.map(([tw]) => tw);
  for (const [i, earlier] of keys.entries()) {
    for (const later of keys.slice(i + 1)) {
      expect(
        later.includes(earlier),
        `« ${later} » contient « ${earlier} » mais vient après`,
      ).toBe(false);
    }
  }
});

test("the projection changes vocabulary only, never structure", () => {
  // Same keys, same nesting, same array lengths—the shape the Translation
  // type guarantees for hand-written pages must hold for the derived one too.
  const shape = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === "object"
      ? Object.fromEntries(
        Object.entries(value).map(([key, v]) => [key, shape(v)]),
      )
      : typeof value;

  expect(shape(translations["zh-hk"])).toEqual(shape(translations["zh-hant"]));
});

test("the two Chinese Traditional pages really do differ", () => {
  // A lexicon that silently emptied would leave an identical page, and every
  // assertion above would still pass except this one.
  expect(hongKong).not.toBe(taiwan);
});
