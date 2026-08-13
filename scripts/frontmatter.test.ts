/*
 * Two jobs are tested here, and they are not the same. Bun parses the YAML —
 * so the forms an author expects from any other static site generator have to
 * work. This module validates it — so every rule the contract states has to be
 * enforced with the file path in the message.
 */

import { expect, test } from "bun:test";
import { parseFrontmatter } from "./frontmatter.ts";

const PATH = "content/posts/x/fr.md";
const block = (...lines: string[]) =>
  ["---", ...lines, "---", "", "Le corps."].join("\n");

test("reads the required fields and returns the body without the block", () => {
  const { data, body } = parseFrontmatter(
    block("title: Mesurer le texte", "date: 2026-08-08"),
    PATH,
  );

  expect(data.title).toBe("Mesurer le texte");
  expect(data.date).toBe("2026-08-08");
  expect(data.tags).toEqual([]);
  expect(data.draft).toBe(false);
  expect(body).toBe("Le corps.");
});

test("reads the optional fields", () => {
  const { data } = parseFrontmatter(
    block(
      "title: T",
      "date: 2026-08-08",
      "summary: Un résumé.",
      "tags: [typographie, bun]",
      "draft: true",
      "updated: 2026-08-09",
    ),
    PATH,
  );

  expect(data.summary).toBe("Un résumé.");
  expect(data.tags).toEqual(["typographie", "bun"]);
  expect(data.draft).toBe(true);
  expect(data.updated).toBe("2026-08-09");
});

test("keeps quotes that belong to the text", () => {
  const { data } = parseFrontmatter(
    block(`title: "Le mot « juste »"`, "date: 2026-08-08"),
    PATH,
  );

  expect(data.title).toBe("Le mot « juste »");
});

/*
 * The three cases below were impossible under the hand-written parser. They
 * are ordinary YAML, so an author reaches for them without being told, and
 * they now work. The tests that asserted their refusal described a limitation
 * of the code, never a rule of the product.
 */

test("accepts comments, whole-line and trailing", () => {
  const { data } = parseFrontmatter(
    block(
      "# what this article is",
      "title: T # the visible title",
      "date: 2026-08-08",
    ),
    PATH,
  );

  expect(data.title).toBe("T");
});

test("accepts tags as a block sequence, and an empty one", () => {
  const { data } = parseFrontmatter(
    block(
      "title: T",
      "date: 2026-08-08",
      "tags:",
      "  - typographie",
      "  - bun",
    ),
    PATH,
  );
  expect(data.tags).toEqual(["typographie", "bun"]);

  const empty = parseFrontmatter(
    block("title: T", "date: 2026-08-08", "tags: []"),
    PATH,
  );
  expect(empty.data.tags).toEqual([]);
});

test("accepts a folded and a literal multi-line summary", () => {
  const folded = parseFrontmatter(
    block(
      "title: T",
      "date: 2026-08-08",
      "summary: >",
      "  Une phrase",
      "  qui continue.",
    ),
    PATH,
  );
  expect(folded.data.summary).toBe("Une phrase qui continue.");

  const literal = parseFrontmatter(
    block(
      "title: T",
      "date: 2026-08-08",
      "summary: |",
      "  Ligne un.",
      "  Ligne deux.",
    ),
    PATH,
  );
  expect(literal.data.summary).toBe("Ligne un.\nLigne deux.");
});

/*
 * A colon followed by a space opens a mapping in YAML, so a title carrying one
 * must be quoted. This is the one syntax rule an author will actually trip
 * over — French and Spanish punctuation reach for « : » constantly — so the
 * refusal has to say what to do, not merely that something went wrong.
 */

test("accepts a quoted title containing a colon", () => {
  const { data } = parseFrontmatter(
    block(`title: "Bun : ce qu'il sait faire"`, "date: 2026-08-08"),
    PATH,
  );

  expect(data.title).toBe("Bun : ce qu'il sait faire");
});

test("refuses an unquoted title containing a colon, and says to quote it", () => {
  const source = block("title: Bun : ce qu'il sait faire", "date: 2026-08-08");

  expect(() => parseFrontmatter(source, PATH)).toThrow(PATH);
  expect(() => parseFrontmatter(source, PATH)).toThrow(/quoted/);
});

/*
 * YAML hands back real types, so the contract has to check types and not only
 * presence: `title: 42` is a number, and a quoted `draft: "true"` is a string
 * that would otherwise publish an article its author believes is a draft.
 */

test.each([
  ["no block at all", "Juste du texte."],
  ["unterminated block", "---\ntitle: T\ndate: 2026-08-08"],
  ["missing title", block("date: 2026-08-08")],
  ["missing date", block("title: T")],
  ["malformed date", block("title: T", "date: 8 août 2026")],
  ["impossible date", block("title: T", "date: 2026-02-31")],
  ["loose date", block("title: T", "date: 2026-8-8")],
  ["unknown key", block("title: T", "date: 2026-08-08", "auteur: X")],
  ["duplicate key", block("title: T", "title: U", "date: 2026-08-08")],
  ["non-boolean draft", block("title: T", "date: 2026-08-08", "draft: oui")],
  [
    "quoted boolean draft",
    block("title: T", "date: 2026-08-08", `draft: "true"`),
  ],
  ["numeric title", block("title: 42", "date: 2026-08-08")],
  ["null title", block("title: null", "date: 2026-08-08")],
  ["empty title", block(`title: ""`, "date: 2026-08-08")],
  ["tags not a list", block("title: T", "date: 2026-08-08", "tags: a, b")],
  [
    "tags holding a number",
    block("title: T", "date: 2026-08-08", "tags: [1, 2]"),
  ],
  ["stray scalar line", block("title: T", "date: 2026-08-08", "bonjour")],
])("refuses: %s", (_label, source) => {
  expect(() => parseFrontmatter(source, PATH)).toThrow(PATH);
});

/*
 * A fence is a fence only at column 0. An indented one lives inside a block
 * scalar, and treating it as the close did not fail the build — it published a
 * page whose summary stopped early, whose tags had silently become empty, and
 * whose body opened with the leftover YAML as prose.
 */
test("an indented --- inside a block scalar does not close the block", () => {
  const { data, body } = parseFrontmatter(
    [
      "---",
      "title: A note",
      "date: 2026-01-01",
      "summary: |",
      "  First line of the summary.",
      "  ---",
      "  Still the summary.",
      "tags: [a]",
      "---",
      "",
      "The real body.",
    ].join("\n"),
    "x.md",
  );

  expect(data.summary).toBe(
    "First line of the summary.\n---\nStill the summary.",
  );
  expect(data.tags).toEqual(["a"]);
  expect(body).toBe("The real body.");
});

test("an indented opening fence is not a frontmatter block at all", () => {
  expect(() => parseFrontmatter("  ---\ntitle: T\n  ---\n", "x.md"))
    .toThrow("no frontmatter block");
});
