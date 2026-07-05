/*
 * Knuth–Plass unit tests, canvas-free: a synthetic monospace measure (10px per
 * character) is injected instead of pretext, so the algorithm itself — break
 * feasibility, width limits, hyphenation, NBSP handling — is what's under test.
 */

import { expect, test } from "bun:test";
import { breakIntoLines, type MeasureFn } from "./linebreak";

/** Every character 10px wide, whatever the font. */
const CHAR = 10;
const mono: MeasureFn = (text) => text.length * CHAR;

const FONT = "normal 400 16px Test";

test("returns null for languages without hyphenation (Chinese wraps natively)", async () => {
  expect(await breakIntoLines("这是一个测试段落", FONT, 200, "zh", mono))
    .toBeNull();
  expect(await breakIntoLines("這是一個測試段落", FONT, 200, "zh-hant", mono))
    .toBeNull();
});

test("returns null for a non-positive width", async () => {
  expect(await breakIntoLines("some text", FONT, 0, "en", mono)).toBeNull();
  expect(await breakIntoLines("some text", FONT, -50, "en", mono)).toBeNull();
});

test("keeps a short text on a single line", async () => {
  const lines = await breakIntoLines("hello world", FONT, 500, "en", mono);
  expect(lines).toEqual(["hello world"]);
});

test("breaks a paragraph into multiple lines that all fit the width", async () => {
  const text =
    "The quick brown fox jumps over the lazy dog while the cat watches from a warm windowsill nearby";
  const width = 300; // 30 chars per line
  const lines = await breakIntoLines(text, FONT, width, "en", mono);
  expect(lines).not.toBeNull();
  expect(lines!.length).toBeGreaterThan(1);
  for (const line of lines!) {
    // shrink: 0 — every chosen line must fit; justify only ever stretches.
    expect(mono(line, FONT)).toBeLessThanOrEqual(width);
    expect(line.length).toBeGreaterThan(0);
  }
});

test("reconstructs the original words (hyphenated splits rejoin cleanly)", async () => {
  const text =
    "Economics student with professional experience in information technology completing an intensive program";
  const lines = await breakIntoLines(text, FONT, 250, "en", mono);
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
  const lines = await breakIntoLines(text, FONT, 250, "en", mono);
  expect(lines).not.toBeNull();
  expect(lines!.some((line) => line.endsWith("-"))).toBe(true);
});

test("treats NBSP as unbreakable (French typographic spaces)", async () => {
  // With a plain space the pair splits over two lines...
  expect(await breakIntoLines("aaaa bbbb", FONT, 40, "fr", mono)).toEqual([
    "aaaa",
    "bbbb",
  ]);
  // ...with an NBSP it is one 9-char token, too wide for the column: no layout.
  expect(await breakIntoLines("aaaa\u00A0bbbb", FONT, 40, "fr", mono))
    .toBeNull();
});

test("returns null when no feasible layout exists (unbreakable word wider than the column)", async () => {
  // One syllable, so hyphenation cannot save it: 9 chars = 90px in a 50px column.
  expect(await breakIntoLines("strengths", FONT, 50, "en", mono)).toBeNull();
});
