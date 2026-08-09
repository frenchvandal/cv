/*
 * Regenerate the vendored Noto subsets (run on demand: `bun run fonts:update`).
 *
 * Noto changes very rarely, so the .woff2 files are committed and the normal
 * build stays hermetic (offline/CI-safe, deterministic). Run this ONLY when the
 * user-visible text gains new characters—especially Chinese ones—so the
 * subset covers them. It re-extracts the exact glyph set, subsets the four
 * full Noto variable fonts LOCALLY with fonttools' pyftsubset, and rewrites
 * src/fonts/*.woff2 and src/fonts.ts (with fresh unicode-range values).
 *
 * Why local: the previous implementation asked the Google Fonts API (`&text=`)
 * for each subset. That endpoint caps the request, and past a few hundred CJK
 * characters it silently answers the standard full-font CSS—hundreds of slices
 * instead of one subset—so the first slice was vendored and the coverage guard
 * went red by a thousand glyphs. pyftsubset has no such cap, and subsetting
 * from the same full fonts Google serves keeps the result deterministic.
 *
 * Requirements, isolated in .venv-fonts/ (gitignored):
 *   python3 -m venv .venv-fonts
 *   .venv-fonts/bin/pip install fonttools brotli
 * The full source fonts are downloaded once from google/fonts into
 * .venv-fonts/cache/ and reused across runs.
 *
 * The glyph sets come from [scripts/glyphs.ts](scripts/glyphs.ts), shared with
 * the coverage guard (scripts/fonts-coverage.test.ts) that fails whenever the
 * text drifts ahead of the committed subsets. Shared CJK codepoints get the
 * right regional glyph variant from their respective family (SC = PRC forms,
 * TC = Taiwan MOE).
 */

import { glyphSets } from "./glyphs.ts";

const VENV = ".venv-fonts";
const PYFTSUBSET = `${VENV}/bin/pyftsubset`;
const CACHE = `${VENV}/cache`;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Fail rather than hang; a stalled socket looks like work in progress. */
const FETCH_TIMEOUT_MS = 30_000;

/** The full variable fonts, straight from google/fonts, downloaded once. */
const SOURCES = {
  latin: {
    file: `${CACHE}/NotoSans.ttf`,
    url:
      "https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf",
    out: "src/fonts/noto-sans-latin.woff2",
  },
  sc: {
    file: `${CACHE}/NotoSansSC.ttf`,
    url:
      "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    out: "src/fonts/noto-sans-sc.woff2",
  },
  tc: {
    file: `${CACHE}/NotoSansTC.ttf`,
    url:
      "https://github.com/google/fonts/raw/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf",
    out: "src/fonts/noto-sans-tc.woff2",
  },
  hk: {
    file: `${CACHE}/NotoSansHK.ttf`,
    url:
      "https://github.com/google/fonts/raw/main/ofl/notosanshk/NotoSansHK%5Bwght%5D.ttf",
    out: "src/fonts/noto-sans-hk.woff2",
  },
} as const;

async function ensureTooling(): Promise<void> {
  if (!(await Bun.file(PYFTSUBSET).exists())) {
    throw new Error(
      `${PYFTSUBSET} not found. Set up the isolated tooling first:\n` +
        `  python3 -m venv ${VENV}\n` +
        `  ${VENV}/bin/pip install fonttools brotli`,
    );
  }
  for (const { file, url } of Object.values(SOURCES)) {
    if (await Bun.file(file).exists()) continue;
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
    }
    await Bun.write(file, await response.arrayBuffer());
    console.log(`  downloaded ${file}`);
  }
}

/**
 * The glyph set as a CSS unicode-range value: codepoints sorted, consecutive
 * ones coalesced. Computed from the set itself, so the committed range can
 * never drift from what the subset was asked to carry.
 */
function unicodeRange(text: string): string {
  const cps = [...new Set(text)]
    .map((ch) => ch.codePointAt(0)!)
    .sort((a, b) => a - b);
  const hex = (cp: number) => cp.toString(16).toUpperCase();
  const parts: string[] = [];
  let lo = -1;
  let prev = -1;
  for (const cp of cps) {
    if (cp !== prev + 1) {
      if (lo !== -1) {
        parts.push(lo === prev ? `U+${hex(lo)}` : `U+${hex(lo)}-${hex(prev)}`);
      }
      lo = cp;
    }
    prev = cp;
  }
  if (lo !== -1) {
    parts.push(lo === prev ? `U+${hex(lo)}` : `U+${hex(lo)}-${hex(prev)}`);
  }
  return parts.join(", ");
}

await ensureTooling();

const { latin, sc, tc, hk } = await glyphSets();
const sets = { latin, sc, tc, hk };
console.log(
  `Glyphs — Latin: ${latin.length}, SC: ${sc.length}, TC: ${tc.length}, HK: ${hk.length}`,
);

/*
 * Every subset is built before any of them is moved into place: a failed run
 * leaves src/fonts/ untouched, never half-fresh beside a stale fonts.ts.
 */
async function subsetFont(
  key: keyof typeof sets,
): Promise<{ out: string; range: string; tmp: string }> {
  const { file, out } = SOURCES[key];
  const text = sets[key];
  const textFile = `${CACHE}/${key}.txt`;
  const tmp = `${CACHE}/${key}.woff2`;
  await Bun.write(textFile, text);
  const proc = await Bun
    .$`${PYFTSUBSET} ${file} --text-file=${textFile} --flavor=woff2 --no-hinting --output-file=${tmp}`
    .nothrow()
    .quiet();
  if (proc.exitCode !== 0) {
    throw new Error(`pyftsubset failed for ${key}: ${proc.stderr}`);
  }
  return { out, range: unicodeRange(text), tmp };
}

const [latinFont, scFont, tcFont, hkFont] = await Promise.all([
  subsetFont("latin"),
  subsetFont("sc"),
  subsetFont("tc"),
  subsetFont("hk"),
]);

for (const { out, tmp } of [latinFont, scFont, tcFont, hkFont]) {
  const bytes = await Bun.file(tmp).arrayBuffer();
  await Bun.write(out, bytes);
  console.log(`  wrote ${out} (${Math.round(bytes.byteLength / 1024)} KB)`);
}

const fontsTs = `/*
 * Self-hosted Noto Sans (Latin) + Noto Sans SC/TC/HK (subset to the glyphs used).
 * Generated by scripts/update-fonts.ts—run \`bun run fonts:update\` to refresh.
 *
 * The woff2 files are imported (not referenced via CSS \`url()\`): Bun inlines
 * CSS-referenced fonts as base64, but a JS import goes through the \`file\` loader
 * and is emitted as a separate hashed asset. \`unicode-range\` keeps the CJK files
 * lazy, and each page's \`--font\` stack names only its own CJK family (SC or TC),
 * so a visitor never downloads a Chinese subset they don't read.
 *
 * The @font-face rules exist in two places, on purpose:
 *   - the SSG build ([scripts/build.ts](scripts/build.ts)) inlines them into each
 *     pre-rendered <head> (fonts load before JS, and no-JS visitors get them too);
 *   - this module injects them at runtime as a fallback for the dev shell, and
 *     skips itself when the build-injected <style data-fonts> is already present.
 *
 * A named font (not \`system-ui\`) is required for accurate pretext measurement.
 */

import latinUrl from "./fonts/noto-sans-latin.woff2";
import scUrl from "./fonts/noto-sans-sc.woff2";
import tcUrl from "./fonts/noto-sans-tc.woff2";
import hkUrl from "./fonts/noto-sans-hk.woff2";

const LATIN_RANGE =
  "${latinFont.range}";
const SC_RANGE =
  "${scFont.range}";
const TC_RANGE =
  "${tcFont.range}";
const HK_RANGE =
  "${hkFont.range}";

/** The four subsets with their build-emitted URLs and unicode ranges. */
export const FONT_FACES = [
  { family: "Noto Sans", url: latinUrl, range: LATIN_RANGE },
  { family: "Noto Sans SC", url: scUrl, range: SC_RANGE },
  { family: "Noto Sans TC", url: tcUrl, range: TC_RANGE },
  { family: "Noto Sans HK", url: hkUrl, range: HK_RANGE },
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
// from run to run—let the project's formatter have the last word so a
// regeneration never shows up as style churn in the diff.
await Bun.$`deno fmt --quiet src/fonts.ts`.nothrow();
console.log("  wrote src/fonts.ts");
console.log("\n✓ Fonts regenerated. Rebuild with `bun run build`.");
