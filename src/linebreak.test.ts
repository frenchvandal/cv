/*
 * Knuth–Plass unit tests, canvas-free: a synthetic monospace measure (10px per
 * character) is injected instead of pretext, so the algorithm itself—break
 * feasibility, width limits, hyphenation, NBSP handling—is what's under test.
 */

import { expect, test } from "bun:test";
import {
  breakIntoLines,
  breakIntoLinesFlat,
  type MeasureFn,
  type Run,
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
 * The run-aware contract: the same algorithm, fed styled runs. A bold span is
 * 12px/char here, the prose 10px—the flat measurement that would charge them
 * equally is exactly the mis-measure this contract exists to kill.
 */

const BOLD = "normal 700 16px Test";
const CODE = "normal 400 14px Mono";
const wide: MeasureFn = (text, font) =>
  text.length * (font === BOLD ? 12 : font === CODE ? 9 : CHAR);

const PROSE_RUNS: Run[] = [
  {
    text: "I led the cross-company rollout of single sign-on and drove ",
    font: FONT,
  },
  { text: "evidence-based decisions", font: BOLD },
  { text: " from user feedback across the whole platform", font: FONT },
];

/** The width a laid-out line actually occupies, computed per fragment. */
function lineWidth(
  line: { fragments: { text: string; run: number }[] },
  runs: readonly Run[],
): number {
  return line.fragments.reduce(
    (total, f) => total + wide(f.text, runs[f.run]!.font),
    0,
  );
}

test("every line fits the column when runs are measured in their own font", async () => {
  const width = 300;
  const lines = await breakIntoLines(PROSE_RUNS, width, "en", wide);
  expect(lines).not.toBeNull();
  for (const line of lines!) {
    expect(lineWidth(line, PROSE_RUNS)).toBeLessThanOrEqual(width);
  }
});

test("the styled run survives the round trip, intact and still marked", async () => {
  const lines = await breakIntoLines(PROSE_RUNS, 300, "en", wide);
  const styled = lines!.map((l) =>
    l.fragments.filter((f) => f.run === 1).map((f) => f.text).join("")
  );
  expect(styled.some((text) => text !== "")).toBe(true);
  // The styled words rejoin across any hyphen break the optimiser chose.
  expect(styled.join("\n").replace(/-\n/g, "").replace(/\n/g, " ").trim())
    .toBe("evidence-based decisions");
});

test("no text is lost or duplicated across fragments", async () => {
  const original = PROSE_RUNS.map((r) => r.text).join("").split(/\s+/).filter(
    Boolean,
  );
  const lines = await breakIntoLines(PROSE_RUNS, 300, "en", wide);
  const words = lines!
    .map((l) => l.fragments.map((f) => f.text).join(""))
    .join("\n")
    .replace(/-\n/g, "") // a hyphen added at a split rejoins its word
    .split(/\s+/)
    .filter(Boolean);
  expect(words).toEqual(original);
});

test("measuring the bold run as regular overflows (the negative control)", async () => {
  // Lay out with the flat (wrong) measure, then read the lines with the true
  // one: a line that "fit" at 10px/char overflows at 12px/char for the bold
  // part. This is the bug run-aware measurement removes.
  const lines = await breakIntoLines(PROSE_RUNS, 300, "en", mono);
  expect(lines).not.toBeNull();
  expect(Math.max(...lines!.map((l) => lineWidth(l, PROSE_RUNS))))
    .toBeGreaterThan(300);
});

test("a run with extraWidth is atomic and its padding is charged", async () => {
  const runs: Run[] = [
    { text: "call ", font: FONT },
    { text: "getData()", font: CODE, extraWidth: 12 },
    { text: " here", font: FONT },
  ];
  // "call getData()" = 40 + 10 + (81 + 12) = 143px with the padding charged:
  // it justifies in a 145px column, and the code run stays whole.
  const fits = await breakIntoLines(runs, 145, "en", mono9);
  expect(fits).not.toBeNull();
  expect(fits!.flatMap((l) => l.fragments.map((f) => f.text)))
    .toContain("getData()");
  // At 140 the charged line overflows, and the only looser layout is a line
  // with no glue to stretch—so there is no layout at all. Without the
  // padding charge (131px), that same column fits: the extraWidth is exactly
  // what tips it over.
  expect(await breakIntoLines(runs, 140, "en", mono9)).toBeNull();
  const unpadded: Run[] = [
    runs[0]!,
    { text: "getData()", font: CODE },
    runs[2]!,
  ];
  expect(await breakIntoLines(unpadded, 140, "en", mono9)).not.toBeNull();
});

const mono9: MeasureFn = (text, font) =>
  text.length * (font === CODE ? 9 : CHAR);

test("a space at a run boundary is kept, on the run to its left", async () => {
  const runs: Run[] = [
    { text: "the", font: FONT },
    { text: " end", font: BOLD },
  ];
  const lines = await breakIntoLines(runs, 500, "en", wide);
  expect(
    lines!.map((l) => l.fragments.map((f) => f.text).join("")).join("\n"),
  ).toBe("the end");
});

test("rich and flat agree, line for line, on flat text in every hyphenated language", async () => {
  const texts = [
    "The quick brown fox jumps over the lazy dog while the cat watches nearby",
    "Economics student with professional experience in information technology",
    "extraordinary considerations regarding international macroeconomics",
  ];
  for (const lang of ["en", "fr", "pt", "es"] as const) {
    for (const text of texts) {
      for (const width of [150, 200, 250, 300, 400]) {
        const flat = await breakIntoLinesFlat(text, FONT, width, lang, mono);
        const rich = await breakIntoLines(
          [{ text, font: FONT }],
          width,
          lang,
          mono,
        );
        expect(
          rich?.map((l) => l.fragments.map((f) => f.text).join("")) ?? null,
        ).toEqual(flat);
      }
    }
  }
});
