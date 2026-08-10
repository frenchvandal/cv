/*
 * Markdown rendering is the only door through which HTML nobody hand-wrote
 * enters the pages. These tests hold both ends: the rewrites the HTMLRewriter
 * pass has to perform, and what the guard has to refuse.
 */

import { expect, test } from "bun:test";
import {
  assertSafeHtml,
  assertSafeMarkdown,
  renderMarkdown,
  slugifyHeading,
} from "./markdown.ts";

test("headings are given a slugified id", async () => {
  const html = await renderMarkdown("## Mesurer le texte, sans reflow", "fr");
  expect(html).toContain('<h2 id="mesurer-le-texte-sans-reflow"');
});

test("a heading id stays unique when the text repeats", async () => {
  const html = await renderMarkdown("## Notes\n\ntexte\n\n## Notes", "fr");
  expect(html).toContain('id="notes"');
  expect(html).toContain('id="notes-2"');
});

test("a derived id does not overwrite a literal one already taken", async () => {
  // “Notes” repeated gives notes and then notes-2 by deduplication; but a
  // third heading reading literally “Notes 2” slugifies to notes-2 as well.
  // The per-base counter has to give way to tracking the ids actually handed
  // out, on pain of emitting id="notes-2" twice.
  const html = await renderMarkdown(
    "## Notes\n\n## Notes\n\n## Notes 2",
    "fr",
  );
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1] ?? "");
  expect(ids).toEqual(["notes", "notes-2", "notes-2-2"]);
  expect(new Set(ids).size).toBe(3);
});

test("external links are given rel, internal ones are not", async () => {
  const html = await renderMarkdown(
    "[dehors](https://exemple.test) et [dedans](../cv.html)",
    "fr",
  );
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(1);
});

test("a table is wrapped in a scrollable container", async () => {
  const html = await renderMarkdown("| a | b |\n|---|---|\n| 1 | 2 |", "fr");
  expect(html).toContain('<div class="table-scroll">');
  expect(html.indexOf('<div class="table-scroll">'))
    .toBeLessThan(html.indexOf("<table>"));
});

test("images are lazy", async () => {
  const html = await renderMarkdown("![chat](a.png)", "fr");
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('decoding="async"');
});

test("a CJK run inside a Latin page is marked (RGAA 8.7)", async () => {
  const html = await renderMarkdown("On dit 微辣 à Chengdu.", "fr");
  expect(html).toContain('<span lang="zh-Hans">微辣</span>');
});

test("a Chinese page marks nothing: there is no change of language", async () => {
  const html = await renderMarkdown("成都的微辣。", "zh");
  expect(html).not.toContain('lang="zh-Hans"');
});

test("the CJK marking does not reach into inline code", async () => {
  // Decision: code is not prose, and a screen reader has nothing to gain from
  // a change of language on an identifier. The `text` handler on
  // "p, li, td, th, h2, h3, h4, blockquote" still receives the text of its
  // descendants (here a <code> nested in a <p>): the code/pre depth counter
  // has to neutralize the marking in spite of that bubbling.
  const html = await renderMarkdown("Du texte avec `du code 微辣` ici.", "fr");
  expect(html).toContain("<code>du code 微辣</code>");
  expect(html).not.toContain('lang="zh-Hans"');
});

test("nor does it reach into a fenced code block", async () => {
  const html = await renderMarkdown("```\n微辣\n```", "fr");
  expect(html).not.toContain('lang="zh-Hans"');
});

test.each([
  ["<script>alert(1)</script>"],
  ['<iframe src="x"></iframe>'],
  ['<img src=x onerror="alert(1)">'],
  ["<SCRIPT>alert(1)</SCRIPT>"],
])("the guard refuses %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test("the guard lets ordinary Markdown through", () => {
  expect(() =>
    assertSafeMarkdown("Du *texte* et `du code`.", "content/posts/x/fr.md")
  ).not.toThrow();
});

test.each([
  ["[x](javascript:alert(1))"],
  ['<a href="javascript:alert(1)">'],
])("the guard also refuses %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test.each([
  ["réglez online=true dans la config"],
  ["le paramètre oneshot=1"],
  ["passez onward=2"],
])("the guard is not fooled by an “on…=” outside a tag: %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test.each([
  ["<img/onerror=alert(1)>"],
  ["<svg/onload=alert(1)>"],
])(
  "the guard lets %s through: a slash against the tag name opens no tag in CommonMark",
  (source) => {
    // Measured: Bun.markdown.html() requires a space before an attribute (the
    // CommonMark grammar for inline tags). Without that space,
    // "<img/onerror=…>" is recognized as a tag by no CommonMark parser; it
    // comes back out as escaped text—&lt;img/onerror=alert(1)&gt;—so never as
    // a real <img> node. assertSafeHtml has nothing to refuse: there is
    // nothing to execute in the page.
    const html = Bun.markdown.html(source);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg");
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .not.toThrow();
  },
);

test("the guard refuses a <script> an escaped backtick lets through (regression)", () => {
  // `\`` is an escaped backtick: CommonMark therefore opens no code span, and
  // Bun.markdown.html() lets the <script> that follows out as it stands,
  // executable. A regex over the source that paired this escaped backtick
  // with the real backtick further along would miss it; the analysis runs on
  // the rendered HTML, where that <script> is a node in earnest.
  const source = "before \\` <script>alert(1)</script>` after";
  expect(Bun.markdown.html(source)).toContain("<script>");
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .toThrow("content/posts/x/fr.md");
});

test("the guard lets a fence inside a block quote through", () => {
  // FENCED_CODE required the fence at the start of a line; a fence indented
  // under a quote’s ">" missed it—a false positive that analysing the
  // rendered HTML fixes for free, since Bun.markdown.html() already knows it
  // is <pre><code> inside a <blockquote>, whatever the source indentation.
  const source = [
    "> Voici un exemple :",
    "> ```",
    "> <script>alert(1)</script>",
    "> ```",
  ].join("\n");
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("assertSafeHtml refuses a <script> appearing as such in already-rendered HTML", () => {
  expect(() => assertSafeHtml("<script>alert(1)</script>", "x"))
    .toThrow("x");
});

test("assertSafeHtml lets a <script> already escaped into text through", () => {
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
  "the guard refuses the seven vectors of the external audit: %s",
  (source) => {
    // Each produces a real node in Bun.markdown.html() (measured) and got
    // past the blacklist guard of the previous round: none is
    // <script>/<iframe>/<object>/<embed>, none carries an on…= attribute, and
    // the javascript: scheme sits either on an attribute never examined
    // (action, formaction, xlink:href) or in disguise (entity, tab, newline).
    // The element whitelist refuses form/button/svg/meta without ever having
    // named them; URI normalization unmasks the three disguises on <a href>.
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .toThrow("content/posts/x/fr.md");
  },
);

test("the guard refuses an element outside the whitelist", () => {
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
  "the guard refuses the entities the browser decodes and it does not: %s",
  (source) => {
    // The browser decodes &colon;, &Tab;, &NewLine; (the full HTML5 table)
    // and numeric references without a semicolon (&#106… → j). The guard does
    // not reproduce that table: what it cannot decode is refused, by default,
    // like everything else.
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .toThrow("content/posts/x/fr.md");
  },
);

test("the guard lets a query string with an ordinary “&” through", () => {
  // An “&” with no complete reference behind it is not an entity: refusing by
  // default must not break ordinary query URLs.
  expect(() =>
    assertSafeMarkdown(
      "[x](https://exemple.test/?a=1&b=2)",
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test("the guard lets a comment anchor behind a query string through", () => {
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
  "an out-of-range numeric reference is refused by the guard, not by a RangeError: %s",
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

test("tightening the numeric class does not reopen &#106avascript: (regression)", () => {
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
  ["[x](../cv.html)"],
  ["[x](#ancre)"],
])("the guard lets legitimate URI schemes through: %s", (source) => {
  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
});

test("a leading C0 control in an href is refused, over the whole U+0000-U+001F range and in all three spellings", () => {
  // Chrome (headless, --dump-dom, measured) resolves "&#1;javascript:alert(1)"
  // to protocol: "javascript:" — the leading control disappears in WHATWG
  // parsing and what remains starts with a forbidden scheme. Before this fix
  // stripUrlControlChars removed only \t/\n/\r; the other 29 C0 values went
  // through the guard intact. All three spellings have to be closed: decimal,
  // hexadecimal, and the raw byte straight in the HTML.
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

test("the C0 fix does not break the legitimate URIs already covered (regression)", () => {
  for (
    const source of [
      "[x](https://exemple.test)",
      "[x](mailto:a@b.test)",
      "[x](../cv.html)",
      "[x](#ancre)",
      "[voir](https://exemple.test/article?ref=twitter&#comment-42)",
    ]
  ) {
    expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
      .not.toThrow();
  }
});

test("the guard lets through all the GFM syntax the repository exercises", async () => {
  // The proof that the whitelist is not too narrow: an article using every
  // GFM construct listed in the review (headings, lists, task lists, tables
  // with alignment, inline and fenced code, block quotes, links including an
  // autolink, images, emphasis, strikethrough, thematic break, hard line
  // break) must never be refused.
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
    "Texte avec un [lien interne](../cv.html) et une [ancre](#section) et un [mailto](mailto:a@b.test).",
  ].join("\n");

  expect(() => assertSafeMarkdown(source, "content/posts/x/fr.md"))
    .not.toThrow();
  await expect(renderMarkdown(source, "fr")).resolves.toBeString();
});

test("the guard lets a code example in an inline span through", () => {
  expect(() =>
    assertSafeMarkdown(
      "Utilisez `<script>` pour charger un module.",
      "content/posts/x/fr.md",
    )
  ).not.toThrow();
});

test("the guard lets a code example in a fenced block through", () => {
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

test("slugifyHeading transliterates and leaves no doubtful character", () => {
  expect(slugifyHeading("Mesurer : le « texte » !")).toBe("mesurer-le-texte");
  expect(slugifyHeading("Déjà vu")).toBe("deja-vu");
});

test("two concurrent renders do not mix up their heading ids", async () => {
  const [a, b] = await Promise.all([
    renderMarkdown("## Alpha", "fr"),
    renderMarkdown("## Beta", "fr"),
  ]);

  expect(a).toContain('id="alpha"');
  expect(a).not.toContain('id="beta"');
  expect(b).toContain('id="beta"');
  expect(b).not.toContain('id="alpha"');
});
