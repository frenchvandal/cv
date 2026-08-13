/*
 * Article frontmatter: parsed by Bun, validated here.
 *
 * The split matters. `Bun.YAML.parse` owns the grammar, so authors write the
 * YAML they already know from every other static site generator — comments,
 * block sequences, folded scalars, quoting. This module owns the *contract*:
 * which keys exist, which are required, and what a value has to be. YAML is
 * permissive by design (it keeps the last of two duplicate keys, accepts any
 * key, coerces `42` to a number), and none of that is acceptable in a file
 * whose mistakes would otherwise surface as a silently wrong page — an empty
 * title, a date from 1970 — instead of a build error fixed in ten seconds.
 *
 * An earlier version parsed the YAML by hand as well. That was work Bun
 * already did; only the validation was ever worth writing.
 */

/**
 * A fence, and only at column 0.
 *
 * `line.trim() === "---"` accepted an INDENTED `---`, which is exactly what a
 * block scalar contains when it quotes one:
 *
 *     summary: |
 *       First line.
 *       ---            ← closed the frontmatter here
 *       Still summary.
 *     tags: [a]
 *
 * The build did not fail. It published a page whose summary stopped at the
 * first line, whose `tags` had silently become empty, and whose body opened
 * with the leftover YAML as prose. YAML puts its document markers at column 0
 * for this reason; so does this.
 */
const FENCE = /^---[ \t]*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN = ["title", "date", "summary", "tags", "draft", "updated"] as const;

/** A top-level key line, used to catch duplicates YAML would silently drop. */
const TOP_LEVEL_KEY = /^([A-Za-z0-9_-]+)\s*:/;

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

/**
 * A date that exists, not merely one that is shaped right: 2026-02-31 parses
 * as a string but is not a day, and would render as a page dated in March.
 */
function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

/**
 * Duplicate top-level keys, which `Bun.YAML.parse` resolves by keeping the
 * last one. Two `title:` lines mean the author lost track of their own file,
 * so we refuse rather than pick for them. Indented lines are skipped: they
 * belong to a block sequence or a folded scalar, not to this level.
 */
function assertNoDuplicateKeys(block: string, path: string): void {
  const seen = new Set<string>();
  for (const line of block.split("\n")) {
    const key = TOP_LEVEL_KEY.exec(line)?.[1];
    if (!key) continue;
    if (seen.has(key)) fail(path, `duplicate key "${key}"`);
    seen.add(key);
  }
}

/**
 * YAML’s own error, reworded. Its message names a line and a token, which is
 * useless without the file; and the one syntax error an author actually hits
 * is an unquoted colon-space inside a title, which deserves to be named.
 */
function parseYaml(block: string, path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(block);
  } catch (error) {
    fail(
      path,
      `invalid YAML frontmatter (${
        (error as Error).message
      }). A value containing ": " must be quoted, e.g. title: "Bun : what it does".`,
    );
  }
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(path, "frontmatter must be a mapping of key to value");
  }
  return parsed as Record<string, unknown>;
}

function assertKnownKeys(data: Record<string, unknown>, path: string): void {
  for (const key of Object.keys(data)) {
    if (!(KNOWN as readonly string[]).includes(key)) {
      fail(path, `unknown key "${key}" (expected: ${KNOWN.join(", ")})`);
    }
  }
}

/**
 * Tags, which YAML hands over already shaped as an array — from either the
 * inline `[a, b]` or the block form. Only their contents need checking.
 */
function readTags(value: unknown, path: string): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, "tags must be a list");
  return value.map((tag) => {
    if (typeof tag !== "string" || !tag.trim()) {
      fail(path, `tags must be non-empty strings, got ${JSON.stringify(tag)}`);
    }
    return tag.trim();
  });
}

export function parseFrontmatter(
  source: string,
  path: string,
): { data: Frontmatter; body: string } {
  const lines = source.split("\n");
  if (!FENCE.test(lines[0] ?? "")) fail(path, "no frontmatter block");

  const end = lines.findIndex((line, i) => i > 0 && FENCE.test(line));
  if (end === -1) fail(path, "unterminated frontmatter block");

  const block = lines.slice(1, end).join("\n");
  assertNoDuplicateKeys(block, path);
  const data = parseYaml(block, path);
  assertKnownKeys(data, path);

  const { title, date, summary, tags, draft, updated } = data;

  if (typeof title !== "string" || !title.trim()) {
    fail(path, '"title" is required and must be a non-empty string');
  }
  if (date === undefined) fail(path, '"date" is required');
  if (!isRealDate(date)) {
    fail(path, `invalid date ${JSON.stringify(date)} (expected YYYY-MM-DD)`);
  }
  if (updated !== undefined && !isRealDate(updated)) {
    fail(
      path,
      `invalid updated ${JSON.stringify(updated)} (expected YYYY-MM-DD)`,
    );
  }
  // A quoted `draft: "true"` is a typo, not an intent: refuse it rather than
  // coerce it, or the article would publish while its author believes otherwise.
  if (draft !== undefined && typeof draft !== "boolean") {
    fail(path, `draft must be true or false, got ${JSON.stringify(draft)}`);
  }
  if (summary !== undefined && typeof summary !== "string") {
    fail(path, "summary must be a string");
  }

  return {
    data: {
      title: title.trim(),
      date,
      tags: readTags(tags, path),
      draft: draft === true,
      ...(summary?.trim() ? { summary: summary.trim() } : {}),
      ...(updated ? { updated } : {}),
    },
    body: lines.slice(end + 1).join("\n").trim(),
  };
}
