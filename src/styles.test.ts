/*
 * The static type sizes in styles.css against the fitting contracts they mirror.
 *
 * `.hero__name` and the three per-language `.nav__link` rules state, in CSS,
 * what src/measure.ts will compute in JS, so that first paint already shows the
 * size the fitter settles on. Both sides are maintained by hand, so every
 * assertion here dies the day one moves without the other—which is exactly what
 * happened: the hero clamp capped at 88px while HERO_FIT.maxPx said 76, and
 * every page flashed one size then settled on another, through every gate.
 *
 * What no assertion here can reach: the width of the rendered text. That number
 * comes from a browser, and pinning it would mean a headless browser in CI to
 * recompute a value that only moves when the name or the display font does. It
 * is declared below instead, and the guards check everything built on top of it.
 * Pure string work otherwise: no canvas, no network.
 */

import { expect, test } from "bun:test";
import { HERO_FIT, NAV_FIT } from "./config.ts";
import { MEASURE_SAFETY } from "./measure.ts";

/**
 * Width of "Philippe Ribeiro" per 1px of font size, at weight 600 and −0.02em
 * tracking, measured in a browser. Re-measuring it (a new name, a new display
 * font) means changing this constant *and* the coefficient in styles.css; the
 * coefficient test below stays red until the two agree again, which is the job.
 */
const HERO_WIDEST_EM = 7.327;

const css = await Bun.file(`${import.meta.dir}/styles.css`).text();

/**
 * A regex guard is only as good as its match: when a rule is reshaped, the
 * pattern stops matching and would silently stop watching. Throwing says so.
 */
function mustMatch(re: RegExp, what: string): RegExpMatchArray {
  const found = css.match(re);
  if (!found) {
    throw new Error(
      `${what} not found in styles.css—the rule’s shape changed, so this guard no longer watches it.`,
    );
  }
  return found;
}

const [, heroMin, heroPadding, heroSlope, heroMax] = mustMatch(
  /clamp\(\s*([\d.]+)px,\s*calc\(\(100vw - ([\d.]+)rem\) \* ([\d.]+)\),\s*([\d.]+)px\)/,
  "the .hero__name clamp",
).map(Number);

test("the hero clamp’s bounds are HERO_FIT’s, in px as HERO_FIT has them", () => {
  // px, not rem: HERO_FIT is in px, so rem bounds would scale with the root
  // font size while the fitter did not, and the flash would come back.
  expect(heroMin).toBe(HERO_FIT.minPx);
  expect(heroMax).toBe(HERO_FIT.maxPx);
});

test("the hero clamp’s slope is fill × MEASURE_SAFETY over the measured width", () => {
  expect(heroSlope).toBeCloseTo(
    HERO_FIT.fill * MEASURE_SAFETY / HERO_WIDEST_EM,
    4,
  );
});

test("the hero clamp subtracts exactly .wrap’s two paddings", () => {
  const spaceMd = Number(
    mustMatch(/--space-md:\s*([\d.]+)rem/, "--space-md")[1],
  );

  expect(heroPadding).toBe(2 * spaceMd);
});

test("the Chinese pages state the cap the fitter holds them at", () => {
  const zh = mustMatch(
    /:root\[data-lang\^='zh'\]\s*\.hero__name\s*\{[^}]*?font-size:\s*([\d.]+)px/,
    "the zh .hero__name rule",
  );

  expect(Number(zh[1])).toBe(HERO_FIT.maxPx);
});

test("every baked nav size is one fitNavLinks could have produced", () => {
  const baked = [
    ...css.matchAll(
      /:root\[data-lang='([\w-]+)'\]\s*\.nav__link\s*\{[^}]*?font-size:\s*([\d.]+)px/g,
    ),
  ].map(([, lang, px]) => [lang, Number(px)] as const);

  // The languages whose labels overrun the bar. en and the Chinese pages fit at
  // the declared size, so a rule for them would be baking a no-op.
  expect(baked.map(([lang]) => lang)).toEqual(["fr", "pt", "es"]);
  for (const [lang, px] of baked) {
    expect(px, `${lang} is outside NAV_FIT`).toBeGreaterThanOrEqual(
      NAV_FIT.minPx,
    );
    expect(px, `${lang} is outside NAV_FIT`).toBeLessThanOrEqual(NAV_FIT.maxPx);
  }
});

test("the same languages bake the gap the fitter spends first", () => {
  const rule = mustMatch(
    /((?::root\[data-lang='[\w-]+'\]\s*\.nav__links,?\s*)+)\{\s*column-gap:\s*([\d.]+)px/,
    "the per-language .nav__links gap",
  );
  const langs = [...rule[1]!.matchAll(/data-lang='([\w-]+)'/g)].map((m) =>
    m[1]
  );

  // Baking the type without the gap leaves the row 40px wide of its settled
  // width, so the set must be the same one, and the value the floor the fitter
  // stops at—`column-gap`, the longhand it writes.
  expect(langs).toEqual(["fr", "pt", "es"]);
  expect(Number(rule[2])).toBe(NAV_FIT.minGapPx);
});

/*
 * The `--font` stacks decide which subsets a page downloads, and the build
 * mirrors them in CJK_FAMILY (scripts/build.ts) to emit the matching
 * @font-face rules. Nothing links the two but this test: naming Noto Sans SC
 * as the Latin fallback here \u2014 which it did \u2014 had an English visitor fetch
 * 342 KB of Chinese font to draw twenty characters, with every gate green.
 */
test("each language names exactly one CJK family, and it is the one the build declares", () => {
  const stacks = [
    ...css.matchAll(
      /:root(?:\[data-lang='([\w-]+)'\])?\s*\{[^}]*?--font:\s*([^;]+);/g,
    ),
  ].map((m) => ({
    lang: m[1] ?? "default",
    stack: m[2]!.replace(/\s+/g, " "),
  }));

  const cjkOf = (stack: string) =>
    ["Noto Sans CJK Inline", "Noto Sans SC", "Noto Sans TC", "Noto Sans HK"]
      .filter((family) => stack.includes(family));

  expect(Object.fromEntries(stacks.map((s) => [s.lang, cjkOf(s.stack)])))
    .toEqual({
      default: ["Noto Sans CJK Inline"],
      zh: ["Noto Sans SC"],
      "zh-hant": ["Noto Sans TC"],
      "zh-hk": ["Noto Sans HK"],
    });

  // And every stack opens with the Latin face, which every page needs.
  for (const { lang, stack } of stacks) {
    expect([lang, stack.startsWith("'Noto Sans',")]).toEqual([lang, true]);
  }
});
