/*
 * Generates public/og-image.png, the 1200×630 card scrapers show when the site
 * is linked (run it with `bun run og:update`).
 *
 * The card used to be a hand-made file, and it drifted twice over: it kept a
 * brutalist look the site no longer has, and it advertised "Available
 * immediately" and "mobile nationwide"—claims this CV deliberately stopped
 * making. Both are failures of the same kind, so the card is generated instead:
 * its text comes from the same PROFILE and translations the page renders from,
 * and its palette and type from the tokens in
 * [src/styles.css](src/styles.css). Editing the hero now edits the card.
 *
 * The build only copies the PNG ([scripts/build.ts](scripts/build.ts)), it does
 * not render it: rendering needs a browser, which no CI runner here installs.
 * Re-run this by hand after changing the English hero, and commit the result.
 * [scripts/og-image.test.ts](scripts/og-image.test.ts) guards what it may say
 * and the size every page advertises for it.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFILE, translations } from "../src/translations.ts";
import { escapeHtml } from "../src/dom.ts";
import { FONT_FACES, fontFaceCss } from "../src/fonts.ts";

/** Baked into every page as og:image:width / og:image:height. Keep in step. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * The card, as a standalone page. `fontCss` carries the @font-face rules: the
 * renderer inlines the real subsets so the card is set in the site’s own Noto
 * Sans, and the test calls this with none, since it only reads the text.
 */
export function ogCardHtml(fontCss = ""): string {
  const t = translations.en;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
${fontCss}
/* The light palette of src/styles.css—the card is the page’s first frame. */
:root {
  --bg: #ffffff;
  --bg-secondary: #f5f5f7;
  --fg: #1d1d1f;
  --fg-secondary: #4b4b50;
  --fg-tertiary: #6e6e73;
  --accent: #0071e3;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${OG_SIZE.width}px;
  height: ${OG_SIZE.height}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  padding: 0 84px;
  background: var(--bg);
  /* A single hairline of colour, the way the page uses its accent: as a mark,
     never as a field. */
  border-top: 10px solid var(--accent);
  font-family: 'Noto Sans', 'Noto Sans SC', system-ui, sans-serif;
  color: var(--fg);
  -webkit-font-smoothing: antialiased;
}
.name {
  font-size: 86px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.05;
}
.alt {
  font-size: 38px;
  font-weight: 400;
  color: var(--fg-tertiary);
  letter-spacing: 0.02em;
}
.title {
  font-size: 40px;
  font-weight: 400;
  line-height: 1.3;
  color: var(--fg-secondary);
  /* Wide enough for the English title to take two lines. A narrow measure
     ragged over four lines reads as a paragraph, and the card is shown small:
     two lines is the most a scraper’s thumbnail carries. */
  max-width: 880px;
  /* Balanced, so the break lands where a reader would put it. */
  text-wrap: balance;
}
.rule {
  width: 72px;
  height: 3px;
  background: var(--fg);
  opacity: 0.16;
}
.where {
  font-size: 27px;
  color: var(--fg-tertiary);
}
</style>
</head>
<body>
  <div>
    <p class="name">${escapeHtml(PROFILE.fullName)}</p>
    <p class="alt">${escapeHtml(PROFILE.chineseName)}</p>
  </div>
  <div class="rule"></div>
  <p class="title">${escapeHtml(t.hero.title)}</p>
  <p class="where">${escapeHtml(t.hero.location)}</p>
</body>
</html>`;
}

/**
 * The families the card draws with: Latin for the name and the title, SC for
 * 李北洛. TC and HK carry the same characters in other forms and no page of the
 * card is written in them, so they would only make the temporary page heavier.
 */
const CARD_FAMILIES = new Set(["Noto Sans", "Noto Sans SC"]);

/**
 * @font-face rules with the subsets inlined as data URIs. The card is rendered
 * from a temporary file:// page, where a linked font is a cross-origin request
 * Chrome refuses—inlining sidesteps that, and costs nothing in a throwaway
 * page.
 *
 * The faces come from FONT_FACES rather than from names spelled out here, and
 * that is the whole point: this function used to name `noto-sans-latin.woff2`
 * and `noto-sans-sc.woff2`, which stopped existing the day the generator
 * started asking Google in batches (`-1`, `-2`…). It failed on ENOENT while
 * every test still passed, since the test renders the card without fonts.
 * FONT_FACES is regenerated with the files themselves, so it cannot fall out
 * of step with them.
 */
async function inlineFontCss(): Promise<string> {
  const faces = FONT_FACES.filter((face) => CARD_FAMILIES.has(face.family));
  const inlined = await Promise.all(faces.map(async (face) => ({
    ...face,
    // In the Bun runtime a `.woff2` import resolves to the file’s own path,
    // which is what makes reading it here possible at all.
    url: `data:font/woff2;base64,${
      Buffer.from(await Bun.file(face.url).arrayBuffer()).toString("base64")
    }`,
  })));
  // The same generator the pages use: one `unicode-range` per batch, so the
  // Chinese name is routed to the SC face that actually carries it instead of
  // relying on a fallthrough between two faces of one family.
  return fontFaceCss(inlined);
}

if (import.meta.main) {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!(await Bun.file(chrome).exists())) {
    console.error(
      `No Chrome at ${chrome}—render the card there and commit it.`,
    );
    process.exit(1);
  }

  // Scratch space outside the repo: a failed render leaves nothing behind to
  // gitignore, and the page carries two embedded fonts nobody wants committed.
  const dir = await mkdtemp(join(tmpdir(), "cv-og-"));
  const page = `${dir}/card.html`;
  await Bun.write(page, ogCardHtml(await inlineFontCss()));

  // Chrome writes the screenshot at the window size, so the viewport is the
  // card: no cropping step, and the PNG is exactly what the tags promise.
  const proc = Bun.spawn([
    chrome,
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--screenshot=${dir}/og-image.png`,
    `--window-size=${OG_SIZE.width},${OG_SIZE.height}`,
    `file://${page}`,
  ], { stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error("Chrome failed to render");

  await Bun.write("public/og-image.png", Bun.file(`${dir}/og-image.png`));
  await rm(dir, { recursive: true, force: true });
  console.log("✓ public/og-image.png");
}
