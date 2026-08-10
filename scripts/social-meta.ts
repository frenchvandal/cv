/*
 * Reads the social-preview metadata back out of a page—Bun’s "extract social
 * share metadata" HTMLRewriter pattern, pointed at our own `dist/` instead of a
 * remote URL (the pages are on disk at build time; fetching them would only add
 * a server).
 *
 * [scripts/build.ts](scripts/build.ts) *writes* those tags; until now nothing
 * read them back, and every way they can break is silent: a misspelt property
 * (`og:titel`), a description that lost its language, or an `og:image` that
 * stayed relative all end the same way—the scraper drops the field, no build
 * error anywhere, and the first sign is a bare link in someone’s chat window.
 * [scripts/build.test.ts](scripts/build.test.ts) asserts against `previewCard`,
 * which resolves the tags the way a scraper does.
 *
 * As a CLI it prints that card for each page given:
 *
 *   bun scripts/social-meta.ts dist/index.html dist/fr/blog/index.html
 */

/** Raw tags found in a page, keyed without their `og:` / `twitter:` prefix. */
export interface SocialTags {
  /** `<meta property="og:…">`—e.g., `title`, `image`, `image:width`. */
  og: Record<string, string>;
  /** `<meta name="twitter:…">`—e.g., `card`, `image`. */
  twitter: Record<string, string>;
  /** `<title>` text. */
  title: string;
  /** `<meta name="description">`. */
  description: string;
  /** `<link rel="canonical">`—relative unless the build ran with SITE_URL. */
  canonical: string;
}

/**
 * Values stay HTML-escaped exactly as they appear in the source: lol-html hands
 * back raw attribute and text bytes, and re-decoding them here would be a second
 * escaping convention to keep in step with [src/dom.ts](src/dom.ts). Compare
 * extracted values against each other, not against the unescaped translations.
 */
export async function extractSocialTags(html: string): Promise<SocialTags> {
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  let title = "";
  let description = "";
  let canonical = "";

  const collect = (
    into: Record<string, string>,
    attr: "property" | "name",
    prefix: string,
  ) => ({
    element(el: HTMLRewriterTypes.Element) {
      const key = el.getAttribute(attr);
      const content = el.getAttribute("content");
      if (key && content) into[key.slice(prefix.length)] = content;
    },
  });

  await new HTMLRewriter()
    .on('meta[property^="og:"]', collect(og, "property", "og:"))
    .on('meta[name^="twitter:"]', collect(twitter, "name", "twitter:"))
    .on('meta[name="description"]', {
      element: (el) => void (description = el.getAttribute("content") ?? ""),
    })
    .on('link[rel="canonical"]', {
      element: (el) => void (canonical = el.getAttribute("href") ?? ""),
    })
    // Text arrives in chunks, so append rather than assign.
    .on("title", { text: (chunk) => void (title += chunk.text) })
    // Consuming the stream is what runs the handlers above.
    .transform(new Response(html))
    .text();

  return { og, twitter, title, description, canonical };
}

/** What a scraper would show for the page. */
export interface PreviewCard {
  title: string;
  description: string;
  /** Absolute when the page carries an absolute base, else as written. */
  image: string | undefined;
  url: string | undefined;
  type: string | undefined;
  locale: string | undefined;
  /** `twitter:card`—`summary_large_image` only counts with an image. */
  card: string | undefined;
}

/**
 * Open Graph first, Twitter Card as the fallback, plain `<title>` /
 * `<meta name="description">` last—the order the scrapers themselves use.
 */
export function previewCard(tags: SocialTags): PreviewCard {
  const image = tags.og.image ?? tags.twitter.image;
  const base = tags.og.url ?? tags.canonical;
  return {
    title: tags.og.title ?? tags.twitter.title ?? tags.title,
    description: tags.og.description ?? tags.twitter.description ??
      tags.description,
    image: image === undefined ? undefined : absolutize(image, base),
    url: tags.og.url,
    type: tags.og.type,
    locale: tags.og.locale,
    card: tags.twitter.card,
  };
}

/**
 * A relative image is worthless to a scraper, which has no page to resolve it
 * against. Resolving it here is what lets the test assert the shipped value is
 * already absolute: `absolutize` changes nothing when it is.
 */
function absolutize(url: string, base: string): string {
  if (URL.canParse(url)) return url;
  if (!URL.canParse(base)) return url;
  return new URL(url, base).href;
}

if (import.meta.main) {
  const files = Bun.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: bun scripts/social-meta.ts <page.html> […]");
    process.exit(1);
  }
  for (const file of files) {
    const card = previewCard(
      await extractSocialTags(await Bun.file(file).text()),
    );
    console.log(`\n${file}`);
    console.log(card);
  }
}
