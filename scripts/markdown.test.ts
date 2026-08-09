/*
 * Le rendu Markdown est la seule porte par laquelle du HTML non écrit à la main
 * entre dans les pages. Ces tests tiennent les deux bouts : les réécritures que
 * la passe HTMLRewriter doit faire, et ce que le garde-fou doit refuser.
 */

import { expect, test } from "bun:test";
import {
  assertSafeHtml,
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

test.each([
  ["<img/onerror=alert(1)>"],
  ["<svg/onload=alert(1)>"],
])(
  "le garde-fou laisse passer %s : la barre oblique collée au nom de balise n'ouvre pas de balise en CommonMark",
  (source) => {
    // Mesuré : Bun.markdown.html() exige un espace avant un attribut (grammaire
    // CommonMark des balises en ligne). Sans cet espace, "<img/onerror=…>" n'est
    // reconnu comme balise par aucun parseur CommonMark ; il ressort en texte
    // échappé — &lt;img/onerror=alert(1)&gt; — donc jamais comme noeud <img> réel.
    // assertSafeHtml n'a rien à refuser : il n'y a rien à exécuter dans la page.
    const html = Bun.markdown.html(source);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg");
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .not.toThrow();
  },
);

test("le garde-fou refuse un <script> qu'un backtick échappé laisse passer (régression)", () => {
  // `\`` est un backtick échappé : CommonMark n'ouvre donc aucun span de code,
  // et Bun.markdown.html() laisse ressortir le <script> qui suit tel quel,
  // exécutable. Une regex sur la source qui apparie ce backtick échappé avec
  // le backtick réel plus loin le manquerait ; l'analyse porte sur le HTML
  // rendu, où ce <script> est un noeud bien réel.
  const source = "before \\` <script>alert(1)</script>` after";
  expect(Bun.markdown.html(source)).toContain("<script>");
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test("le garde-fou laisse passer une fence à l'intérieur d'un blockquote", () => {
  // FENCED_CODE exigeait la fence en début de ligne ; une fence indentée sous
  // un ">" de citation la ratait — faux positif que l'analyse du HTML rendu
  // corrige gratuitement, puisque Bun.markdown.html() sait déjà que c'est du
  // <pre><code> à l'intérieur d'un <blockquote>, peu importe l'indentation
  // source.
  const source = [
    "> Voici un exemple :",
    "> ```",
    "> <script>alert(1)</script>",
    "> ```",
  ].join("\n");
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("assertSafeHtml refuse un <script> qui apparaît tel quel dans du HTML déjà rendu", () => {
  expect(() => assertSafeHtml("<script>alert(1)</script>", "x"))
    .toThrow("x");
});

test("assertSafeHtml laisse passer du <script> déjà échappé en texte", () => {
  const escaped = Bun.markdown.html("`<script>alert(1)</script>`");
  expect(() => assertSafeHtml(escaped, "x")).not.toThrow();
});

test.each([
  ['<form action="javascript:alert(1)">'],
  ['<button formaction="javascript:alert(1)">'],
  ['<a href="&#106;avascript:alert(1)">e</a>'],
  ['<a href="java\tscript:alert(1)">e</a>'],
  ['<a href="java\nscript:alert(1)">e</a>'],
  ['<svg><a xlink:href="javascript:alert(1)">e</a></svg>'],
  ['<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'],
])(
  "le garde-fou refuse les sept vecteurs de l'audit externe : %s",
  (source) => {
    // Chacun produit un noeud réel dans Bun.markdown.html() (measuré) et
    // franchissait le garde-fou en liste noire du round précédent : aucun
    // n'est <script>/<iframe>/<object>/<embed>, aucun n'a d'attribut on…=,
    // et le schéma javascript: y est soit sur un attribut jamais examiné
    // (action, formaction, xlink:href) soit déguisé (entité, tabulation,
    // saut de ligne). La liste blanche d'éléments refuse form/button/svg/meta
    // sans les avoir jamais nommés ; la normalisation d'URI démasque les
    // trois déguisements sur <a href>.
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .toThrow("content/posts/x/fr.md");
  },
);

test("le garde-fou refuse un élément hors liste blanche", () => {
  expect(() =>
    assertSafeMarkdown("<marquee>x</marquee>", "content/posts/x/fr.md")
  ).toThrow("content/posts/x/fr.md");
});

test.each([
  ['<a href="javascript&colon;alert(1)">e</a>'],
  ['<a href="&Tab;javascript:alert(1)">e</a>'],
  ['<a href="java&NewLine;script:alert(1)">e</a>'],
  ['<a href="&#106avascript:alert(1)">e</a>'],
])(
  "le garde-fou refuse les entités que le navigateur décode mais pas lui : %s",
  (source) => {
    // Le navigateur décode &colon;, &Tab;, &NewLine; (table HTML5 complète)
    // et les références numériques sans point-virgule (&#106… → j). Le
    // garde-fou ne reproduit pas la table : ce qu'il ne sait pas décoder
    // est refusé, par défaut, comme tout le reste.
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .toThrow("content/posts/x/fr.md");
  },
);

test("le garde-fou laisse passer une query string avec un « & » ordinaire", () => {
  // « & » sans référence complète n'est pas une entité : le refus par défaut
  // ne doit pas casser les URL de query ordinaires.
  expect(() =>
    assertSafeMarkdown(
      "[x](https://exemple.test/?a=1&b=2)",
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test("le garde-fou laisse passer une ancre de commentaire derrière une query string", () => {
  // "&#comment-42" is not a character reference: the browser only decodes
  // "&#" when digits follow (or x plus hex digits), which is exactly what
  // decodeNumericEntity consumes. UNRESOLVED_ENTITY used to accept letters
  // there as well and rejected this link to a comment — an ordinary URL.
  expect(() =>
    assertSafeMarkdown(
      "[voir](https://exemple.test/article?ref=twitter&#comment-42)",
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
  // Same URL written as raw HTML: the Markdown path escapes the "&" into
  // "&amp;" first, this one hands the guard the "&#" verbatim.
  expect(() =>
    assertSafeHtml(
      '<a href="https://exemple.test/article?ref=twitter&#comment-42">e</a>',
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test.each([
  ['<a href="&#xFFFFFFFF;">e</a>'],
  ['<a href="&#4294967295;">e</a>'],
])(
  "une référence numérique hors plage est refusée par le garde-fou, pas par une RangeError : %s",
  async (source) => {
    // String.fromCodePoint throws above U+10FFFF and nothing caught it: the
    // RangeError crossed the whole guard and killed the build on a generic
    // V8 message naming no file. Out of range is not a valid reference (a
    // browser substitutes U+FFFD for it), so it stays literal text and gets
    // rejected by the ordinary unresolved-entity path, with the article path.
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .toThrow("content/posts/x/fr.md");
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .not.toThrow(RangeError);
    // The build reaches the guard through renderMarkdown, which is where the
    // uncaught exception surfaced.
    await expect(renderMarkdown(source, "fr", "content/posts/x/fr.md"))
      .rejects.toThrow("content/posts/x/fr.md");
  },
);

test("resserrer la classe numérique ne rouvre pas &#106avascript: (non-régression)", () => {
  // UNRESOLVED_ENTITY never caught this vector: decodeNumericEntity consumes
  // "&#106" (the browser decodes it without the trailing semicolon too), so
  // nothing entity-shaped is left when the regex runs — the scheme check is
  // what rejects the decoded "javascript:". Proof that the decoding still
  // happens: the same semicolon-less reference in front of a harmless path
  // decodes to "john" and passes.
  expect(() =>
    assertSafeHtml(
      '<a href="&#106avascript:alert(1)">e</a>',
      "content/posts/x/fr.md",
    )
  ).toThrow("content/posts/x/fr.md");
  expect(() =>
    assertSafeHtml(
      '<a href="https://exemple.test/&#106ohn">e</a>',
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test.each([
  ["[x](https://exemple.test)"],
  ["[x](mailto:a@b.test)"],
  ["[x](./cv.html)"],
  ["[x](#ancre)"],
])("le garde-fou laisse passer les schémas d'URI légitimes : %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("un caractère de contrôle C0 en tête de href est refusé, sur toute la plage U+0000-U+001F et sous ses trois écritures", () => {
  // Chrome (headless, --dump-dom, mesuré) résout "&#1;javascript:alert(1)"
  // en protocol: "javascript:" — le contrôle de tête disparaît au parsing
  // WHATWG et ce qui reste commence par un schéma interdit. stripUrlControlChars
  // ne retirait avant ce correctif que \t/\n/\r ; les 29 autres valeurs C0
  // passaient le garde-fou intactes. Les trois écritures doivent toutes être
  // fermées : décimale, hexadécimale, et l'octet brut directement dans le HTML.
  for (let code = 0; code <= 0x1f; code++) {
    const rawByte = String.fromCodePoint(code);
    const variants = [
      `&#${code};javascript:alert(1)`,
      `&#x${code.toString(16)};javascript:alert(1)`,
      `${rawByte}javascript:alert(1)`,
    ];
    for (const href of variants) {
      expect(() =>
        assertSafeHtml(`<a href="${href}">x</a>`, "content/posts/x/fr.md")
      ).toThrow("content/posts/x/fr.md");
    }
  }
});

test("le correctif C0 ne casse pas les URI légitimes déjà couvertes (non-régression)", () => {
  for (
    const source of [
      "[x](https://exemple.test)",
      "[x](mailto:a@b.test)",
      "[x](./cv.html)",
      "[x](#ancre)",
      "[voir](https://exemple.test/article?ref=twitter&#comment-42)",
    ]
  ) {
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .not.toThrow();
  }
});

test("le garde-fou laisse passer toute la syntaxe GFM que le dépôt exerce", async () => {
  // La preuve que la liste blanche n'est pas trop étroite : un article qui
  // utilise chaque construction GFM listée dans la revue (titres, listes,
  // listes de tâches, tables avec alignement, code en ligne et en bloc,
  // citations, liens dont un autolien, images, emphase, barré, règle
  // horizontale, saut de ligne dur) ne doit jamais être refusé.
  const source = [
    "# Titre niveau 1",
    "## Titre niveau 2",
    "### Titre niveau 3",
    "#### Titre niveau 4",
    "##### Titre niveau 5",
    "###### Titre niveau 6",
    "",
    'Un paragraphe avec *emphase*, **fort**, ~~barré~~, `code en ligne` et un [lien](https://exemple.test "titre").',
    "",
    '![alt d\'une image](a.png "titre image")',
    "",
    "- item de liste",
    "- item avec **fort**",
    "  - item niché",
    "",
    "1. premier",
    "2. second",
    "",
    "- [ ] tâche non faite",
    "- [x] tâche faite",
    "",
    "> une citation",
    "> sur deux lignes",
    "",
    "---",
    "",
    "| a | b | c |",
    "|:--|:-:|--:|",
    "| 1 | 2 | 3 |",
    "",
    "```ts",
    "const x = 1;",
    "```",
    "",
    "Un saut de ligne dur  ",
    "juste ici.",
    "",
    "Autolien : <https://exemple.test/auto>",
    "",
    "Texte avec un [lien interne](./cv.html) et une [ancre](#section) et un [mailto](mailto:a@b.test).",
  ].join("\n");

  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
  await expect(renderMarkdown(source, "fr")).resolves.toBeString();
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
