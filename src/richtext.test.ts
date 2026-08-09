/*
 * The pure assembly of a justified rich paragraph: lines made of styled
 * fragments become markup, escaped, with each run's inline chain reopened in
 * every line it touches. runsFrom needs a real document, so the browser
 * checks own it; what is asserted here is everything after the measurement.
 */

import { expect, test } from "bun:test";
import type { RichLine } from "./linebreak.ts";
import { buildLinesHtml, type RichRun } from "./richtext.ts";

const FONT = "normal 400 16px Test";

const runs: RichRun[] = [
  { text: "plain ", font: FONT, ancestors: [] },
  { text: "styled", font: FONT, ancestors: ["strong"] },
  { text: "link", font: FONT, ancestors: ["a"], href: "./x.html" },
  { text: "code", font: FONT, ancestors: ["code"], extraWidth: 12 },
];

const lines = (fragments: [number, string][][]): RichLine[] =>
  fragments.map((frags) => ({
    fragments: frags.map(([run, text]) => ({ run, text })),
  }));

test("une ligne sans balisage est un seul nœud texte", () => {
  expect(buildLinesHtml(lines([[[0, "hello world"]]]), [
    { text: "hello world", font: FONT, ancestors: [] },
  ]))
    .toBe('<span class="kp-line">hello world</span>');
});

test("la chaîne d'ancêtres est rouverte dans chaque ligne qu'elle touche", () => {
  // The styled run splits across two lines: both must carry the <strong>.
  const html = buildLinesHtml(
    lines([
      [[0, "plain "], [1, "sty"]],
      [[1, "led"]],
    ]),
    runs,
  );
  expect(html).toBe(
    '<span class="kp-line">plain <strong>sty</strong></span>' +
      '<span class="kp-line"><strong>led</strong></span>',
  );
});

test("un lien garde sa cible, échappée comme le texte", () => {
  const html = buildLinesHtml(lines([[[0, "clique"]]]), [
    { ...runs[2]!, text: "clique", href: './x?a="b"' },
  ]);
  expect(html).toBe(
    '<span class="kp-line"><a href="./x?a=&quot;b&quot;">clique</a></span>',
  );
});

test("le code et le del sont rendus avec leurs balises", () => {
  expect(buildLinesHtml(lines([[[3, "x()"]]]), runs))
    .toBe('<span class="kp-line"><code>x()</code></span>');
  expect(
    buildLinesHtml(lines([[[0, "rayé"]]]), [
      { text: "rayé", font: FONT, ancestors: ["del"] },
    ]),
  ).toBe('<span class="kp-line"><del>rayé</del></span>');
});

test("le texte est échappé, jamais le balisage reconstruit", () => {
  expect(
    buildLinesHtml(lines([[[1, "5 < 6 & « x »"]]]), runs),
  ).toBe(
    '<span class="kp-line"><strong>5 &lt; 6 &amp; « x »</strong></span>',
  );
});

test("les ancêtres s'imbriquent du plus externe au plus interne", () => {
  expect(
    buildLinesHtml(lines([[[0, "gras italique"]]]), [
      { text: "gras italique", font: FONT, ancestors: ["strong", "em"] },
    ]),
  ).toBe(
    '<span class="kp-line"><strong><em>gras italique</em></strong></span>',
  );
});
