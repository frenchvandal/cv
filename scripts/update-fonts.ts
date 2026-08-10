/*
 * Regenerate the vendored Noto subsets (run on demand: `bun run fonts:update`).
 *
 * Noto changes very rarely, so the .woff2 files are committed and the normal
 * build stays hermetic (offline/CI-safe, deterministic). Run this ONLY when the
 * user-visible text gains new characters—especially Chinese ones—so the
 * subset covers them. It re-extracts the exact glyph set, fetches the matching
 * Noto Sans / Noto Sans SC / Noto Sans TC subsets, and rewrites
 * src/fonts/*.woff2 and src/fonts.ts (with fresh unicode-range values).
 *
 * The glyph sets come from [scripts/glyphs.ts](scripts/glyphs.ts), shared with
 * the coverage guard (scripts/fonts-coverage.test.ts) that fails whenever the
 * text drifts ahead of the committed subsets. Shared CJK codepoints get the
 * right regional glyph variant from their respective family (SC = PRC forms,
 * TC = Taiwan MOE).
 */

import { rm } from "node:fs/promises";
import { glyphSets } from "./glyphs.ts";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Fail rather than hang. This script is run by hand and its output is committed,
 * so a stalled socket is worse than an error: it looks like work in progress.
 */
const FETCH_TIMEOUT_MS = 30_000;

async function fetchOk(url: string, what: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${what} failed: HTTP ${response.status}`);
  }
  return response;
}

const { latin, sc, tc, hk } = await glyphSets();

console.log(
  `Glyphs — Latin: ${latin.length}, SC: ${sc.length}, TC: ${tc.length}, HK: ${hk.length}`,
);

/*
 * How many glyphs one request may carry.
 *
 * Google’s css2 endpoint text-subsets a family only while the request stays
 * small. Measured on 2026-08-10: 800 glyphs still returns ONE face carrying
 * exactly those glyphs; 900 returns 101 faces — the endpoint has given up on
 * subsetting and fallen back to serving the complete font split by unicode
 * range, which is 13.5 MB across SC, TC and HK.
 *
 * Batching below the cliff keeps every file a real subset. 600 leaves room for
 * the corpus to grow before anyone has to think about this again.
 */
const BATCH = 600;

/**
 * One family’s subsets, one per batch. Each returned face carries its own
 * `unicode-range`, so the browser fetches only the batches a page’s text
 * actually needs — the same mechanism that already kept the CJK files lazy,
 * now at a finer grain.
 *
 * The `@font-face` blocks are read with a global match: a single-match parse
 * silently kept the first block and dropped the rest, which is how a 4 KB
 * "subset" carrying 1% of the glyphs was once written to disk.
 */
async function subsets(
  family: string,
  text: string,
): Promise<{ url: string; range: string }[]> {
  const chars = [...text];
  const batches: string[] = [];
  for (let i = 0; i < chars.length; i += BATCH) {
    batches.push(chars.slice(i, i + BATCH).join(""));
  }

  return await Promise.all(batches.map(async (batch, index) => {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=${family}:wght@400..800` +
      `&text=${encodeURIComponent(batch)}&display=swap`;
    const response = await fetchOk(cssUrl, `Fetching CSS for ${family}`);
    const css = await response.text();
    const faces = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)];
    const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)];
    if (faces.length !== 1 || ranges.length !== 1) {
      throw new Error(
        `${family} batch ${index + 1}: expected one @font-face, got ` +
          `${faces.length}. The batch is above the endpoint’s subsetting ` +
          `cliff — lower BATCH.`,
      );
    }
    return { url: faces[0]![1]!, range: ranges[0]![1]!.trim() };
  }));
}

/** The four faces, each as one or more batched subsets. */
const FAMILIES = [
  { family: "Noto Sans", api: "Noto+Sans", slug: "latin", text: latin },
  { family: "Noto Sans SC", api: "Noto+Sans+SC", slug: "sc", text: sc },
  { family: "Noto Sans TC", api: "Noto+Sans+TC", slug: "tc", text: tc },
  { family: "Noto Sans HK", api: "Noto+Sans+HK", slug: "hk", text: hk },
] as const;

const fetched = await Promise.all(
  FAMILIES.map(async (entry) => ({
    ...entry,
    parts: await subsets(entry.api, entry.text),
  })),
);

/** Every emitted file, in the order the generated module will import them. */
const files = fetched.flatMap((entry) =>
  entry.parts.map((part, index) => ({
    family: entry.family,
    ident: `${entry.slug}${index + 1}`,
    path: `src/fonts/noto-sans-${entry.slug}-${index + 1}.woff2`,
    ...part,
  }))
);

/*
 * Every subset is fetched before any of them is written. Downloading and
 * writing one at a time would, on a network drop halfway through, leave the
 * tree in a state no successful run ever produces: two fresh .woff2 files
 * beside a src/fonts.ts still carrying the previous unicode-ranges. The
 * coverage guard would eventually catch that, but the fix is to not create it—
 * once this array resolves, the write phase does no I/O that can fail partway.
 */
const downloaded = await Promise.all(
  files.map(async (file) => ({
    ...file,
    bytes: await (await fetchOk(file.url, `Downloading ${file.url}`))
      .arrayBuffer(),
  })),
);

/*
 * Stale files from a previous run are removed first. The batch count follows
 * the corpus, so a run that needs two subsets where the last needed three
 * would otherwise leave the third on disk — imported by nothing, shipped by
 * nothing, and quietly wrong the day someone reads the directory.
 */
for await (const stale of new Bun.Glob("noto-sans-*.woff2").scan("src/fonts")) {
  if (!downloaded.some((file) => file.path === `src/fonts/${stale}`)) {
    await rm(`src/fonts/${stale}`);
    console.log(`  removed src/fonts/${stale} (no longer needed)`);
  }
}

let total = 0;
for (const { path, bytes } of downloaded) {
  await Bun.write(path, bytes);
  total += bytes.byteLength;
  console.log(`  wrote ${path} (${Math.round(bytes.byteLength / 1024)} KB)`);
}
console.log(
  `  ${downloaded.length} files, ${Math.round(total / 1024)} KB total`,
);

const fontsTs = `/*
 * Self-hosted Noto Sans (Latin) + Noto Sans SC/TC/HK (subset to the glyphs used).
 * Generated by scripts/update-fonts.ts—run \`bun run fonts:update\` to refresh.
 *
 * The woff2 files are imported (not referenced via CSS \`url()\`): Bun inlines
 * CSS-referenced fonts as base64, but a JS import goes through the \`file\` loader
 * and is emitted as a separate hashed asset. \`unicode-range\` keeps the CJK files
 * lazy, and each page’s \`--font\` stack names only its own CJK family (SC or TC),
 * so a visitor never downloads a Chinese subset they don’t read.
 *
 * The @font-face rules exist in two places, on purpose:
 *   - the SSG build ([scripts/build.ts](scripts/build.ts)) inlines them into each
 *     pre-rendered <head> (fonts load before JS, and no-JS visitors get them too);
 *   - this module injects them at runtime as a fallback for the dev shell, and
 *     skips itself when the build-injected <style data-fonts> is already present.
 *
 * A named font (not \`system-ui\`) is required for accurate pretext measurement.
 */

${
  files.map((f) => `import ${f.ident}Url from "./fonts/${f.path.slice(10)}";`)
    .join("\n")
}

/**
 * Every subset, with its build-emitted URL and the unicode range it covers.
 *
 * A family can span several files: Google’s endpoint stops text-subsetting
 * above roughly 800 glyphs, so the generator asks in batches and each batch
 * comes back with its own range. The browser then fetches only the batches a
 * page’s text needs, which is the same laziness the single files had, at a
 * finer grain.
 */
export const FONT_FACES = [
${
  files.map((f) =>
    `  { family: ${
      JSON.stringify(f.family)
    }, url: ${f.ident}Url, range:\n    "${f.range}" },`
  ).join("\n")
}
] as const;

/** @font-face rules for the given subset URLs (SSG passes its own hashed paths). */
export function fontFaceCss(
  faces: readonly { family: string; url: string; range: string }[],
): string {
  return faces
    .map(
      (f) =>
        \`@font-face{font-family:'\${f.family}';font-style:normal;font-weight:400 800;font-display:swap;src:url(\${f.url}) format('woff2');unicode-range:\${f.range};}\`,
    )
    .join("");
}

// Runtime fallback for the dev shell; pre-rendered pages already carry the rules.
if (
  typeof document !== "undefined" &&
  !document.querySelector("style[data-fonts]")
) {
  const style = document.createElement("style");
  style.dataset.fonts = "runtime";
  style.textContent = fontFaceCss(FONT_FACES);
  document.head.appendChild(style);
}
`;

await Bun.write("src/fonts.ts", fontsTs);
// The template above is written pre-formatted, but the ranges vary in length
// from run to run—let the project’s formatter have the last word so a
// regeneration never shows up as style churn in the diff.
await Bun.$`deno fmt --quiet src/fonts.ts`.nothrow();
console.log("  wrote src/fonts.ts");
console.log("\n✓ Fonts regenerated. Rebuild with `bun run build`.");
