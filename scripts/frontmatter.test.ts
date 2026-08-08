/*
 * Le frontmatter est un sous-ensemble volontairement minuscule : pas de YAML,
 * donc pas de dépendance, et une grammaire assez petite pour que chaque refus
 * soit un message précis plutôt qu'un comportement surprenant.
 */

import { expect, test } from "bun:test";
import { parseFrontmatter } from "./frontmatter.ts";

const PATH = "content/posts/x/fr.md";
const block = (...lines: string[]) =>
  ["---", ...lines, "---", "", "Le corps."].join("\n");

test("lit les champs requis et rend le corps sans le bloc", () => {
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

test("lit les champs optionnels", () => {
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

test("retire une paire de guillemets englobants, pas ceux du texte", () => {
  const { data } = parseFrontmatter(
    block(`title: "Le mot « juste »"`, "date: 2026-08-08"),
    PATH,
  );

  expect(data.title).toBe("Le mot « juste »");
});

test("un deux-points dans la valeur n'est pas un séparateur", () => {
  const { data } = parseFrontmatter(
    block("title: Bun : ce qu'il sait faire", "date: 2026-08-08"),
    PATH,
  );

  expect(data.title).toBe("Bun : ce qu'il sait faire");
});

test.each([
  ["sans bloc du tout", "Juste du texte."],
  ["bloc non fermé", "---\ntitle: T\ndate: 2026-08-08"],
  ["title manquant", block("date: 2026-08-08")],
  ["date manquante", block("title: T")],
  ["date malformée", block("title: T", "date: 8 août 2026")],
  ["date impossible", block("title: T", "date: 2026-02-31")],
  ["clé inconnue", block("title: T", "date: 2026-08-08", "auteur: X")],
  ["clé dupliquée", block("title: T", "title: U", "date: 2026-08-08")],
  ["draft non booléen", block("title: T", "date: 2026-08-08", "draft: oui")],
  ["tags hors crochets", block("title: T", "date: 2026-08-08", "tags: a, b")],
  ["ligne sans deux-points", block("title: T", "date: 2026-08-08", "bonjour")],
])("refuse : %s", (_label, source) => {
  expect(() => parseFrontmatter(source, PATH)).toThrow(PATH);
});
