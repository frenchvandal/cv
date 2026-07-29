/*
 * The Hong Kong page is a projection of the Taiwan one, not a translation of
 * its own (see HK_LEXICON in translations.ts). A projection can rot in two
 * silent ways—a term that no longer appears in the source, so the swap does
 * nothing, and a term that survives the swap—and neither would fail the type
 * checker, since both pages have the same shape by construction. These tests
 * are what stands in for the review a hand-written translation would get.
 */

import { expect, test } from "bun:test";
import { HK_TERMS, translations } from "./translations.ts";

const taiwan = JSON.stringify(translations["zh-hant"]);
const hongKong = JSON.stringify(translations["zh-hk"]);

test.each([...HK_TERMS])(
  "the Taiwan page uses %s, so swapping it for %s is not a no-op",
  (twTerm) => {
    expect(taiwan).toContain(twTerm);
  },
);

test.each([...HK_TERMS])(
  "no Taiwan term survives on the Hong Kong page (%s → %s)",
  (twTerm, hkTerm) => {
    expect(hongKong).not.toContain(twTerm);
    expect(hongKong).toContain(hkTerm);
  },
);

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
