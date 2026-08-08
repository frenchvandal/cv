/*
 * Le rendu Markdown est la seule porte par laquelle du HTML non écrit à la main
 * entre dans les pages. Ces tests tiennent les deux bouts : les réécritures que
 * la passe HTMLRewriter doit faire, et ce que le garde-fou doit refuser.
 */

import { expect, test } from "bun:test";
import {
  assertSafeMarkdown,
  renderMarkdown,
  slugifyHeading,
} from "./markdown.ts";

test("les titres reçoivent un id slugifié", async () => {
  const html = await renderMarkdown("## Mesurer le texte, sans reflow", "fr");
  expect(html).toContain('<h2 id="mesurer-le-texte-sans-reflow"');
});

test("un id de titre reste unique quand le texte se répète", async () => {
  const html = await renderMarkdown("## Notes\n\ntexte\n\n## Notes", "fr");
  expect(html).toContain('id="notes"');
  expect(html).toContain('id="notes-2"');
});

test("un id dérivé n'écrase pas un id littéral déjà pris", async () => {
  // "Notes" répété donne notes puis notes-2 par déduplication ; mais un
  // troisième titre littéralement "Notes 2" slugifie lui aussi en notes-2.
  // Le compteur par base doit céder la place à un suivi des ids réellement
  // posés, sous peine de produire deux fois id="notes-2".
  const html = await renderMarkdown(
    "## Notes\n\n## Notes\n\n## Notes 2",
    "fr",
  );
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? "");
  expect(ids).toEqual(["notes", "notes-2", "notes-2-2"]);
  expect(new Set(ids).size).toBe(3);
});

test("les liens externes reçoivent rel, les internes non", async () => {
  const html = await renderMarkdown(
    "[dehors](https://exemple.test) et [dedans](./cv.html)",
    "fr",
  );
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(1);
});

test("une table est enveloppée dans un conteneur défilable", async () => {
  const html = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |", "fr");
  expect(html).toContain('<div class="table-scroll">');
  expect(html.indexOf('<div class="table-scroll">'))
    .toBeLessThan(html.indexOf("<table>"));
});

test("les images sont paresseuses", async () => {
  const html = await renderMarkdown("![chat](a.png)", "fr");
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('decoding="async"');
});

test("un run CJK dans une page latine est marqué (RGAA 8.7)", async () => {
  const html = await renderMarkdown("On dit 微辣 à Chengdu.", "fr");
  expect(html).toContain('<span lang="zh-Hans">微辣</span>');
});

test("une page chinoise ne marque rien : il n'y a pas de changement de langue", async () => {
  const html = await renderMarkdown("成都的微辣。", "zh");
  expect(html).not.toContain('lang="zh-Hans"');
});

test("le marquage CJK n'entre pas dans du code inline", async () => {
  // Décision : du code n'est pas de la prose, un lecteur d'écran n'a rien à
  // gagner à un changement de langue sur un identifiant. Le handler `text` sur
  // "p, li, td, th, h2, h3, h4, blockquote" reçoit quand même le texte des
  // descendants (ici <code> imbriqué dans <p>) : le compteur de profondeur
  // code/pre doit neutraliser le marquage malgré cette remontée.
  const html = await renderMarkdown("Du texte avec `du code 微辣` ici.", "fr");
  expect(html).toContain("<code>du code 微辣</code>");
  expect(html).not.toContain('lang="zh-Hans"');
});

test("le marquage CJK n'entre pas non plus dans un bloc de code clôturé", async () => {
  const html = await renderMarkdown("```\n微辣\n```", "fr");
  expect(html).not.toContain('lang="zh-Hans"');
});

test.each([
  ["<script>alert(1)</script>"],
  ['<iframe src="x"></iframe>'],
  ['<img src=x onerror="alert(1)">'],
  ["<SCRIPT>alert(1)</SCRIPT>"],
])("le garde-fou refuse %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test("le garde-fou laisse passer du Markdown ordinaire", () => {
  expect(() =>
    assertSafeMarkdown("Du *texte* et `du code`.", "content/posts/x/fr.md")
  ).not.toThrow();
});

test.each([
  ["<img/onerror=alert(1)>"],
  ["<svg/onload=alert(1)>"],
  ["[x](javascript:alert(1))"],
  ['<a href="javascript:alert(1)">'],
])("le garde-fou refuse aussi %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test.each([
  ["réglez online=true dans la config"],
  ["le paramètre oneshot=1"],
  ["passez onward=2"],
])("le garde-fou n'est pas dupe d'un « on…= » hors balise : %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("le garde-fou laisse passer un exemple de code en span inline", () => {
  expect(() =>
    assertSafeMarkdown(
      "Utilisez `<script>` pour charger un module.",
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test("le garde-fou laisse passer un exemple de code en bloc clôturé", () => {
  const source = [
    "Un exemple de charge malveillante :",
    "",
    "```",
    "<script>alert(1)</script>",
    "```",
  ].join("\n");
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("slugifyHeading translittère et ne laisse aucun caractère douteux", () => {
  expect(slugifyHeading("Mesurer : le « texte » !")).toBe("mesurer-le-texte");
  expect(slugifyHeading("Déjà vu")).toBe("deja-vu");
});

test("deux rendus concurrents ne mélangent pas leurs ids de titres", async () => {
  const [a, b] = await Promise.all([
    renderMarkdown("## Alpha", "fr"),
    renderMarkdown("## Beta", "fr"),
  ]);

  expect(a).toContain('id="alpha"');
  expect(a).not.toContain('id="beta"');
  expect(b).toContain('id="beta"');
  expect(b).not.toContain('id="alpha"');
});
