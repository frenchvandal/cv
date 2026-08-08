/*
 * Frontmatter, sous-ensemble minimal et strict.
 *
 * Pas de YAML : la grammaire tient en `clé: valeur`, plus `tags: [a, b]`. Tout
 * ce qui sort de là est refusé avec le chemin du fichier, parce qu'un
 * frontmatter mal lu produit une page silencieusement fausse — un titre vide,
 * une date de 1970 — là où une erreur de build se corrige en dix secondes.
 */

const FENCE = "---";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = ["title", "date", "summary", "tags", "draft", "updated"] as const;
type Key = (typeof KNOWN)[number];

export interface Frontmatter {
  title: string;
  date: string;
  summary?: string;
  tags: readonly string[];
  draft: boolean;
  updated?: string;
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

/** Une date réelle, pas seulement une chaîne bien formée : 2026-02-31 n'existe pas. */
function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

/** Une seule paire de guillemets englobants est du balisage, pas du texte. */
function unquote(value: string): string {
  const quoted = (q: string) =>
    value.length >= 2 && value.startsWith(q) && value.endsWith(q);
  return quoted('"') || quoted("'") ? value.slice(1, -1) : value;
}

export function parseFrontmatter(
  source: string,
  path: string,
): { data: Frontmatter; body: string } {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== FENCE) fail(path, "aucun bloc frontmatter");

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === FENCE);
  if (end === -1) fail(path, "bloc frontmatter non fermé");

  const raw = new Map<Key, string>();
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon === -1) fail(path, `ligne sans « : » : ${JSON.stringify(line)}`);
    const key = line.slice(0, colon).trim();
    if (!(KNOWN as readonly string[]).includes(key)) {
      fail(path, `clé inconnue « ${key} » (attendu : ${KNOWN.join(", ")})`);
    }
    if (raw.has(key as Key)) fail(path, `clé dupliquée « ${key} »`);
    raw.set(key as Key, unquote(line.slice(colon + 1).trim()));
  }

  const title = raw.get("title");
  if (!title) fail(path, "« title » est requis");
  const date = raw.get("date");
  if (!date) fail(path, "« date » est requise");
  if (!isRealDate(date)) fail(path, `date invalide « ${date} » (YYYY-MM-DD)`);

  const updated = raw.get("updated");
  if (updated !== undefined && !isRealDate(updated)) {
    fail(path, `updated invalide « ${updated} » (YYYY-MM-DD)`);
  }

  const rawDraft = raw.get("draft");
  if (rawDraft !== undefined && rawDraft !== "true" && rawDraft !== "false") {
    fail(path, `draft doit valoir true ou false, pas « ${rawDraft} »`);
  }

  const rawTags = raw.get("tags");
  if (rawTags !== undefined && !/^\[.*\]$/.test(rawTags)) {
    fail(path, `tags doit être de la forme [a, b], pas « ${rawTags} »`);
  }
  const tags = rawTags
    ? rawTags.slice(1, -1).split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const summary = raw.get("summary");
  return {
    data: {
      title,
      date,
      tags,
      draft: rawDraft === "true",
      ...(summary ? { summary } : {}),
      ...(updated ? { updated } : {}),
    },
    body: lines.slice(end + 1).join("\n").trim(),
  };
}
