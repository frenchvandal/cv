/*
 * Prototype check: does Knuth–Plass survive being fed styled runs?
 *
 * Synthetic measure, no canvas — the same trick src/linebreak.test.ts uses.
 * Regular text is 10px per character, bold is 13px (a 30% penalty, above the
 * 1.5%–8.1% real deltas measured in Chrome for Noto Sans bold and monospace, so
 * the failure mode is unmistakable).
 *
 * The last test is the one that matters most: on flat text this fork must agree
 * with the shipping module line for line. It is what keeps the experiment honest
 * as [src/linebreak.ts](../../src/linebreak.ts) evolves — if either side drifts,
 * this fails rather than the divergence being discovered at adoption time.
 */
import { expect, test } from "bun:test";
import {
  breakIntoLines,
  breakIntoLinesFlat,
  type MeasureFn,
  type Run,
} from "./linebreak-rich.ts";
import { breakIntoLines as breakShipping } from "../../src/linebreak.ts";

const REG = "400 10px Test";
const BOLD = "700 10px Test";
const perChar = (font: string) => (font === BOLD ? 13 : 10);
const measure: MeasureFn = (text, font) => text.length * perChar(font);

const widthOf = (
  line: { fragments: { text: string; run: number }[] },
  runs: Run[],
) =>
  line.fragments.reduce(
    (sum, f) => sum + f.text.length * perChar(runs[f.run]!.font),
    0,
  );

const TEXT_A = "I led the cross-company rollout of single sign-on and drove ";
const TEXT_B = "evidence-based decisions";
const TEXT_C = " from user feedback across the whole platform.";

const runs: Run[] = [
  { text: TEXT_A, font: REG },
  { text: TEXT_B, font: BOLD, tag: "strong" },
  { text: TEXT_C, font: REG },
];

const WIDTH = 300;

test("every line fits the column when runs are measured in their own font", async () => {
  const lines = await breakIntoLines(runs, WIDTH, "en", measure);
  expect(lines).not.toBeNull();
  for (const line of lines!) {
    expect(widthOf(line, runs)).toBeLessThanOrEqual(WIDTH);
  }
});

test("the styled run survives the round trip, intact and still marked", async () => {
  const lines = await breakIntoLines(runs, WIDTH, "en", measure);
  const bold = lines!
    .flatMap((l) => l.fragments)
    .filter((f) => runs[f.run]!.tag === "strong")
    .map((f) => f.text)
    .join("");
  // Hyphenation may split the run across lines, so compare without hyphens.
  expect(bold.replace(/-/g, "")).toContain("evidence");
  expect(bold.replace(/-/g, "")).toContain("based");
});

test("no text is lost or duplicated", async () => {
  const lines = await breakIntoLines(runs, WIDTH, "en", measure);
  const out = lines!
    .map((l) => l.fragments.map((f) => f.text).join(""))
    .join(" ")
    .replace(/-\s/g, "") // rejoin hyphenated splits
    .replace(/\s+/g, " ")
    .trim();
  const expected = (TEXT_A + TEXT_B + TEXT_C).replace(/\s+/g, " ").trim();
  expect(out).toBe(expected);
});

test("measuring the bold run as regular overflows the column", async () => {
  // This is the current behaviour: one font for the whole paragraph.
  const flatMeasure: MeasureFn = (text) => text.length * 10;
  const lines = await breakIntoLines(runs, WIDTH, "en", flatMeasure);
  // Lines were chosen as if everything were regular, then rendered for real.
  const overflowing = lines!.filter((l) => widthOf(l, runs) > WIDTH);
  expect(overflowing.length).toBeGreaterThan(0);
});

test("agrees with the shipping module, line for line, on flat text", async () => {
  const FONT = "normal 400 16px Test";
  const flat: MeasureFn = (text) => text.length * 10;
  const corpus = [
    "hello world",
    "I led the cross-company rollout of single sign-on and drove decisions",
    "Product Owner and Business Analyst with twenty years in financial-services software",
    "requirements functional specifications integration testing and UAT",
  ];

  for (const text of corpus) {
    for (const width of [120, 200, 250, 300, 480]) {
      const shipping = await breakShipping(text, FONT, width, "en", flat);
      const fork = await breakIntoLinesFlat(text, FONT, width, "en", flat);
      expect(fork).toEqual(shipping);
    }
  }
});
