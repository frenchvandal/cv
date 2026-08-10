/*
 * Loading reads a real disk, so each test builds its own corpus in a
 * temporary folder: no shared fixture to drift, and the tree under test is
 * exactly the one the build will read.
 */

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPosts } from "./content.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((r) => rm(r, { recursive: true, force: true })),
  );
});

/*
 * A site with no articles yet is a legitimate state, not a build failure.
 * `Bun.Glob().scan()` throws ENOENT on a missing directory instead of yielding
 * nothing, and that error names no source file — which would break the "every
 * failure names its file" rule the rest of the pipeline keeps.
 */
test("an absent corpus directory yields an empty list, not an error", async () => {
  const root = await mkdtemp(join(tmpdir(), "cv-content-"));
  roots.push(root);

  expect(await loadPosts(root)).toEqual([]);
});

async function corpus(
  files: Record<string, string>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "cv-content-"));
  roots.push(root);
  for (const [path, source] of Object.entries(files)) {
    await Bun.write(join(root, "posts", path), source);
  }
  return root;
}

const article = (title: string, extra = "") =>
  ["---", `title: ${title}`, "date: 2026-08-08", extra, "---", "", "Le corps."]
    .filter(Boolean)
    .join("\n");

test("découvre un article par langue et rend son HTML", async () => {
  const root = await corpus({
    "mesurer/fr.md": article("Mesurer"),
    "mesurer/en.md": article("Measuring"),
  });

  const posts = await loadPosts(root);

  expect(posts).toHaveLength(2);
  expect(posts.map((p) => p.lang).sort()).toEqual(["en", "fr"]);
  expect(posts[0]!.slug).toBe("mesurer");
  expect(posts.every((p) => p.html.includes("<p>Le corps.</p>"))).toBe(true);
  expect(posts.every((p) => p.text.includes("Le corps."))).toBe(true);
});

test("les brouillons sont exclus, sauf sous DRAFTS=1", async () => {
  const root = await corpus({
    "publie/fr.md": article("Publié"),
    "brouillon/fr.md": article("Brouillon", "draft: true"),
  });

  expect((await loadPosts(root)).map((p) => p.slug)).toEqual(["publie"]);

  process.env.DRAFTS = "1";
  try {
    expect((await loadPosts(root)).map((p) => p.slug).sort())
      .toEqual(["brouillon", "publie"]);
  } finally {
    delete process.env.DRAFTS;
  }
});

test("zh-hk est dérivé de zh-hant par projection lexicale", async () => {
  const root = await corpus({
    "x/zh-hant.md": [
      "---",
      "title: 軟體與網路",
      "date: 2026-08-08",
      "---",
      "",
      "談談軟體。",
    ].join("\n"),
  });

  const posts = await loadPosts(root);
  const hk = posts.find((p) => p.lang === "zh-hk");

  expect(hk).toBeDefined();
  expect(hk!.title).toBe("軟件與網絡");
  expect(hk!.html).toContain("軟件");
  expect(hk!.html).not.toContain("軟體");
});

test("un zh-hk explicite l'emporte sur la projection", async () => {
  const root = await corpus({
    "x/zh-hant.md": article("台灣版"),
    "x/zh-hk.md": article("香港版"),
  });

  const hk = (await loadPosts(root)).find((p) => p.lang === "zh-hk");
  expect(hk!.title).toBe("香港版");
});

test("un zh-hk sans zh-hant correspondant est chargé tel quel", async () => {
  // The projection is additive, not a requirement: a hand-written zh-hk
  // does not need a Taiwan sibling to be valid on its own.
  const root = await corpus({ "y/zh-hk.md": article("HK seul") });

  const posts = await loadPosts(root);

  expect(posts).toHaveLength(1);
  expect(posts[0]!.lang).toBe("zh-hk");
  expect(posts[0]!.title).toBe("HK seul");
});

test("le résumé vient du frontmatter, sinon du texte", async () => {
  const root = await corpus({
    "a/fr.md": article("A", "summary: Écrit à la main."),
    "b/fr.md": article("B"),
  });

  const posts = await loadPosts(root);
  expect(posts.find((p) => p.slug === "a")!.summary).toBe("Écrit à la main.");
  expect(posts.find((p) => p.slug === "b")!.summary).toBe("Le corps.");
});

test("un slug réservé casse le chargement", async () => {
  const root = await corpus({ "cv/fr.md": article("Collision") });
  expect(loadPosts(root)).rejects.toThrow("cv");
});

test("un nom de fichier qui n'est pas une langue casse le chargement", async () => {
  const root = await corpus({ "x/de.md": article("Deutsch") });
  expect(loadPosts(root)).rejects.toThrow("de");
});

test("du HTML dangereux casse le chargement, avec le chemin", async () => {
  const root = await corpus({
    "x/fr.md": [
      "---",
      "title: T",
      "date: 2026-08-08",
      "---",
      "",
      "<script>alert(1)</script>",
    ].join("\n"),
  });

  expect(loadPosts(root)).rejects.toThrow("x/fr.md");
});

test("l'ordre de sortie est déterministe, trié par slug puis par langue", async () => {
  // Bun.Glob().scan() was measured (see task-5-report.md) to hand back
  // entries in an order that is neither insertion order nor lexicographic —
  // stable within one process, but not something a consumer should rely on.
  // loadPosts sorts explicitly so the build output does not depend on it.
  const root = await corpus({
    "zebra/en.md": article("Z-EN"),
    "zebra/fr.md": article("Z-FR"),
    "apple/fr.md": article("A-FR"),
  });

  const posts = await loadPosts(root);

  expect(posts.map((p) => `${p.slug}/${p.lang}`)).toEqual([
    "apple/fr",
    "zebra/en",
    "zebra/fr",
  ]);
});

test("Post.text ne colle aucun mot à travers une frontière de bloc", async () => {
  // Exercises the syntax this blog’s articles use: heading, paragraph,
  // bullet list, table, fenced code block. Measured (see task-5-report.md):
  // Bun.markdown.render() with no callbacks glues every block straight into
  // the next one — "Sous-titrePremier", "item unitem deux", "Col ACol B",
  // "val1val2" — with zero separator, not even a space.
  const body = [
    "## Sous-titre",
    "",
    "Premier paragraphe.",
    "",
    "- item un",
    "- item deux",
    "",
    "| Col A | Col B |",
    "| ----- | ----- |",
    "| val1  | val2  |",
    "",
    "```js",
    "const x = 1;",
    "```",
    "",
    "Dernier paragraphe.",
  ].join("\n");
  const root = await corpus({
    "riche/fr.md": [
      "---",
      "title: Riche",
      "date: 2026-08-08",
      "---",
      "",
      body,
    ].join("\n"),
  });

  const post = (await loadPosts(root))[0]!;

  for (
    const glued of [
      "Sous-titrePremier",
      "paragraphe.item",
      "unitem",
      "deuxCol",
      "ACol",
      "Bval1",
      "val1val2",
    ]
  ) {
    expect(post.text).not.toContain(glued);
  }
});

test("le résumé dérivé coupe en fin de première phrase, même sur un texte multi-paragraphe", async () => {
  // This is the test that proves the dead branch in deriveSummary is
  // reachable again. Without a separator between blocks, the period at the
  // end of the first paragraph touches the next paragraph directly (no
  // space), so deriveSummary’s search for ". " never matches and it falls
  // through to a mid-word truncation instead of cutting on the sentence.
  const firstSentence =
    "Ceci est la première phrase du contenu, volontairement assez longue " +
    "pour bien depasser le tiers du budget de resume et se terminer proprement.";
  const filler =
    "Ensuite vient un second paragraphe de remplissage sans aucune " +
    "ponctuation forte a l intérieur qui sert seulement a pousser le total " +
    "du texte assez loin au dela de la limite de deux cents caracteres afin " +
    "de forcer une troncature quelque part dans ce flux de mots";
  const root = await corpus({
    "long/fr.md": [
      "---",
      "title: Long",
      "date: 2026-08-08",
      "---",
      "",
      firstSentence,
      "",
      filler,
    ].join("\n"),
  });

  const post = (await loadPosts(root))[0]!;

  expect(post.summary).toBe(firstSentence);
});
