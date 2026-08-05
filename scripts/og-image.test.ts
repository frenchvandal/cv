/*
 * The social preview card. Two things can go wrong with an image nobody looks
 * at until it is already in someone's chat window:
 *
 *   - it says something the site does not. The previous card advertised
 *     "Available immediately" and "mobile nationwide"—claims this CV stopped
 *     making, still promising them to every scraper that fetched it.
 *   - it stops matching the tags. `og:image:width`/`height` are baked into
 *     every page by [scripts/build.ts](scripts/build.ts); a re-render at
 *     another size crops or letterboxes on whichever platform trusts them.
 *
 * The first is testable because the card's text is generated, not typed: it
 * comes from the same PROFILE and translations the page renders from. The
 * second is asserted on the shipped bytes.
 */

import { expect, test } from "bun:test";
import { OG_SIZE, ogCardHtml } from "./og-image.ts";
import { PROFILE, translations } from "../src/translations.ts";

const ROOT = `${import.meta.dir}/..`;

test("the card says what the site says, from the same source", () => {
  const html = ogCardHtml();
  const t = translations.en;

  expect(html).toContain(PROFILE.fullName);
  expect(html).toContain(PROFILE.chineseName);
  // Verbatim from the hero, so editing the page edits the card.
  expect(html).toContain(t.hero.title);
  expect(html).toContain(t.hero.location);
});

test("the card makes no claim the CV has stopped making", () => {
  // This is not a job application: no availability, no mobility, no "looking
  // for a role"—on the page or in the card that stands in for it.
  const html = ogCardHtml().toLowerCase();

  for (
    const claim of [
      "available",
      "immediately",
      "mobile nationwide",
      "nationwide",
      "open to",
      "looking for",
      "seeking",
      "hire",
    ]
  ) {
    expect(html).not.toContain(claim);
  }
});

test("the shipped PNG is the size every page advertises", async () => {
  const bytes = new Uint8Array(
    await Bun.file(`${ROOT}/public/og-image.png`).arrayBuffer(),
  );

  // PNG signature, then the IHDR chunk: width and height are big-endian u32 at
  // byte 16 and 20. Read straight from the file rather than trusted from the
  // generator, which is not run by the build.
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect(view.getUint32(16)).toBe(OG_SIZE.width);
  expect(view.getUint32(20)).toBe(OG_SIZE.height);

  // The same numbers the build writes into og:image:width / og:image:height.
  expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
});
