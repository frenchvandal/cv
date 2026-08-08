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

test("un run CJK niché dans du code inline reste bien formé", async () => {
  // Le handler `text` sur "p, li, td, th, h2, h3, h4, blockquote" reçoit aussi
  // le texte des descendants (ici un <code> imbriqué dans le <p>) : on vérifie
  // que le marquage ne casse pas la structure quand le nœud texte n'est pas un
  // enfant direct de l'élément écouté.
  const html = await renderMarkdown("Du texte avec `du code 微辣` ici.", "fr");
  expect(html).toContain(
    '<code>du code <span lang="zh-Hans">微辣</span></code>',
  );
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
