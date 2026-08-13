/*
 * Knuth–Plass unit tests, canvas-free: a synthetic monospace measure (10px per
 * character) is injected instead of pretext, so the algorithm itself—break
 * feasibility, width limits, hyphenation, NBSP handling—is what’s under test.
 */

import { expect, test } from "bun:test";
import {
  breakIntoLines,
  breakIntoLinesFlat,
  type MeasureFn,
} from "./linebreak.ts";

/** Every character 10px wide, whatever the font. */
const CHAR = 10;
const mono: MeasureFn = (text) => text.length * CHAR;

const FONT = "normal 400 16px Test";

test("returns null for languages without hyphenation (Chinese wraps natively)", async () => {
  expect(await breakIntoLinesFlat("这是一个测试段落", FONT, 200, "zh", mono))
    .toBeNull();
  expect(
    await breakIntoLinesFlat("這是一個測試段落", FONT, 200, "zh-hant", mono),
  )
    .toBeNull();
});

test("returns null for a non-positive width", async () => {
  expect(await breakIntoLinesFlat("some text", FONT, 0, "en", mono)).toBeNull();
  expect(await breakIntoLinesFlat("some text", FONT, -50, "en", mono))
    .toBeNull();
});

test("keeps a short text on a single line", async () => {
  const lines = await breakIntoLinesFlat("hello world", FONT, 500, "en", mono);
  expect(lines).toEqual(["hello world"]);
});

test("breaks a paragraph into multiple lines that all fit the width", async () => {
  const text =
    "The quick brown fox jumps over the lazy dog while the cat watches from a warm windowsill nearby";
  const width = 300; // 30 chars per line
  const lines = await breakIntoLinesFlat(text, FONT, width, "en", mono);
  expect(lines).not.toBeNull();
  expect(lines!.length).toBeGreaterThan(1);
  for (const line of lines!) {
    // shrink: 0—every chosen line must fit; justify only ever stretches.
    expect(mono(line, FONT)).toBeLessThanOrEqual(width);
    expect(line.length).toBeGreaterThan(0);
  }
});

test("reconstructs the original words (hyphenated splits rejoin cleanly)", async () => {
  const text =
    "Economics student with professional experience in information technology completing an intensive program";
  const lines = await breakIntoLinesFlat(text, FONT, 250, "en", mono);
  expect(lines).not.toBeNull();
  const rebuilt = lines!
    .map((line) => (line.endsWith("-") ? line.slice(0, -1) : `${line} `))
    .join("")
    .trim()
    .replace(/\s+/g, " ");
  expect(rebuilt).toBe(text);
});

test("hyphenates long words across lines with a visible hyphen", async () => {
  // A narrow column forces syllable breaks somewhere in the paragraph.
  const text =
    "extraordinary considerations regarding international macroeconomics";
  const lines = await breakIntoLinesFlat(text, FONT, 250, "en", mono);
  expect(lines).not.toBeNull();
  expect(lines!.some((line) => line.endsWith("-"))).toBe(true);
});

test("breaks after an existing hyphen without drawing a second one", async () => {
  // "cross-company" is 13 chars = 130px, too wide for the column, and the Liang
  // patterns never offer the hard hyphen itself as a break point.
  const lines = await breakIntoLinesFlat(
    "aaaa cross-company bbbb",
    FONT,
    120,
    "en",
    mono,
  );
  expect(lines).toEqual(["aaaa cross-", "company bbbb"]);
});

test("never splits a slash-joined acronym pair", async () => {
  const text =
    "rollout of single sign-on using SAML/OIDC across every client company today";
  for (const width of [150, 200, 250]) {
    const lines = await breakIntoLinesFlat(text, FONT, width, "en", mono);
    expect(lines).not.toBeNull();
    // Split over two lines it would read as "SAML/" then "OIDC"—worse than a
    // loose line, so the slash is deliberately not a break point.
    expect(lines!.some((line) => line.includes("SAML/OIDC"))).toBe(true);
    expect(lines!.some((line) => line.endsWith("/"))).toBe(false);
  }
});

test("treats NBSP as unbreakable (French typographic spaces)", async () => {
  // With a plain space the pair splits over two lines...
  expect(await breakIntoLinesFlat("aaaa bbbb", FONT, 40, "fr", mono)).toEqual([
    "aaaa",
    "bbbb",
  ]);
  // ...with an NBSP it is one 9-char token, too wide for the column: no layout.
  expect(await breakIntoLinesFlat("aaaa\u00A0bbbb", FONT, 40, "fr", mono))
    .toBeNull();
});

test("returns null when no feasible layout exists (unbreakable word wider than the column)", async () => {
  // One syllable, so hyphenation cannot save it: 9 chars = 90px in a 50px column.
  expect(await breakIntoLinesFlat("strengths", FONT, 50, "en", mono))
    .toBeNull();
});

/*
 * A line can end inside a word for two different reasons, and only one of them
 * needs a hyphen drawn. Conflating them pasted `cross- company`: the break at
 * the author's own hyphen was flagged neither way, so the clipboard rejoined
 * the halves with a space.
 */
test("a break at an authored hyphen is a word break, not a drawn hyphen", async () => {
  const lines = await breakIntoLines(
    [{ text: "alpha cross-company beta gamma delta", font: FONT }],
    13 * CHAR,
    "en",
    mono,
  );

  const first = lines![0]!;
  expect(first.fragments.map((f) => f.text).join("")).toBe("alpha cross-");
  // The hyphen is already in the text, so nothing must be drawn…
  expect(first.hyphenated).toBeUndefined();
  // …but the next line continues the word, so rejoining adds nothing.
  expect(first.midWord).toBe(true);
});

test("a hyphenated break is both drawn and rejoined without a space", async () => {
  const lines = await breakIntoLines(
    [{ text: "alpha communication beta", font: FONT }],
    10 * CHAR,
    "en",
    mono,
  );

  const broken = lines!.find((line) => line.hyphenated);
  expect(broken?.midWord).toBe(true);
});

/*
 * Inline code is atomic because its padding and borders are charged to it
 * whole. A space merged into that run is painted inside the `<code>`: the grey
 * field runs past the word and the space is drawn in monospace after being
 * measured in prose, which is how a line ends up wider than the column it was
 * computed for.
 */
test("a space beside an atomic run takes the prose run, not the code one", async () => {
  const lines = await breakIntoLines(
    [
      { text: "before ", font: "prose" },
      { text: "code", font: "mono", extraWidth: 12 },
      { text: " after words here", font: "prose" },
    ],
    20 * CHAR,
    "en",
    mono,
  );

  const withCode = lines!.find((line) =>
    line.fragments.some((f) => f.run === 1)
  )!;
  const codeFragment = withCode.fragments.find((f) => f.run === 1)!;

  expect(codeFragment.text).toBe("code");
  expect(withCode.fragments.find((f) => f.text.startsWith(" "))?.run).toBe(2);
});
