/*
 * Markdown → HTML, in two movements.
 *
 * 1. `Bun.markdown.html()` does the GFM rendering. It is native, so the blog
 *    carries no rendering dependency—but it lets raw HTML through, hence the
 *    guard below.
 * 2. An `HTMLRewriter` pass applies what the renderer does not: heading
 *    anchors, `rel` on external links, scrollable tables, lazy images, and
 *    the RGAA marking of Chinese runs.
 *
 * The CJK marking goes through the text-node handler here, not through a
 * regular expression over an escaped string as in src/render.ts: it therefore
 * cannot structurally reach an attribute or a tag name.
 *
 * INTERNAL LINKS: no rewriting, and that is a measured choice. Articles live
 * at `blog/x.html` in English and `<lang>/blog/x.html` elsewhere, so the same
 * relative spelling resolves correctly at both depths:
 *
 *   ./other.html   → the neighbouring article (blog/other.html, fr/blog/other.html)
 *   ../cv.html     → this language’s CV       (cv.html, fr/cv.html)
 *   ../            → this language’s home     (/, fr/)
 *   ./             → the blog index           (blog/, fr/blog/)
 *
 * The CV always sits one level above `blog/`, in every language: that is what
 * makes the layout self-consistent. Rewriting `./x` as “from the site root”
 * would instead break the most natural link an article can carry, the one to
 * its neighbour.
 */

import type { Lang } from "../src/translations.ts";

/*
 * CJK ideographs and CJK punctuation—the runs that need a declared language.
 *
 * Escapes, not literals. Written as characters, the last range read
 * `豈-﫿`, and the 豈 a keyboard produces is U+8C48 (unified) rather than the
 * U+F900 (compatibility) that was meant: the class ran from U+8C48 to U+FAFF
 * and swallowed Hangul, Yi and the private use area, so Korean in an article
 * would have been announced as Chinese to a screen reader.
 */
const CJK_RUN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/g;

/*
 * Measured, not remembered: the set of tags Bun.markdown.html() produces for
 * all the GFM syntax this repository exercises (h1-h6 headings, emphasis,
 * strong, strikethrough, inline and fenced code, block quotes, plain,
 * numbered and task lists, tables with alignment, links including autolinks,
 * images, thematic break, hard line break). An earlier round blocked known
 * tags one by one (`script`, `iframe`…); an audit found seven vectors that
 * were not on that list (`form`, `button`, `svg`…). A blacklist of tags is
 * open by construction—one unforeseen eighth vector is enough. This list is
 * closed the other way round: anything absent from it is refused, known or
 * not.
 */
const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

/** Navigation and loading attributes—the only ones where a URI scheme runs. */
const URI_ATTRIBUTES = new Set(["href", "src"]);

/*
 * `href`/`src` closed in their turn: only http, https, mailto and the
 * relative form (no scheme) are legitimate in an article. As with the tags,
 * closing the list avoids having to know in advance every way of writing
 * `javascript:`—HTML entity, tab, letter case…
 */
const ALLOWED_URI_SCHEMES = new Set(["http", "https", "mailto"]);

/** HTMLRewriter already lowercases attribute names: a prefix test is enough. */
function isEventAttribute(name: string): boolean {
  return name.startsWith("on");
}

const NAMED_ENTITIES = new Map<string, string>([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);

/**
 * A numeric reference (`&#106;`, `&#x6A;`) encodes any character letter by
 * letter — the vector measured in the audit (`&#106;avascript:`). The
 * browser also decodes it WITHOUT the semicolon (`&#106avascript` →
 * `javascript`, with a mere parse error): greedy digits, optional
 * semicolon, exactly the same.
 */
function decodeNumericEntity(
  value: string,
  start: number,
): { ch: string; end: number } | null {
  let i = start + 2; // after "&#"
  const hex = value.charAt(i) === "x" || value.charAt(i) === "X";
  if (hex) i++;
  let digits = "";
  while (i < value.length) {
    const ch = value.charAt(i);
    const ok = (ch >= "0" && ch <= "9") ||
      (hex && ((ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")));
    if (!ok) break;
    digits += ch;
    i++;
  }
  if (!digits) return null;
  const code = Number.parseInt(digits, hex ? 16 : 10);
  // Past the last Unicode plane String.fromCodePoint throws a RangeError,
  // which would cross the whole guard and kill the build on a generic V8
  // message naming no file — one typo in an article is enough. A browser
  // does not read the announced character there either: it substitutes
  // U+FFFD. So it is not a reference; leave it as literal text and let
  // UNRESOLVED_ENTITY reject it below, with the path of the offending file.
  if (code > 0x10ffff) return null;
  if (value.charAt(i) === ";") i++;
  return { ch: String.fromCodePoint(code), end: i };
}

/*
 * One-pass decoding, like the browser. Named entities are limited to the
 * five of XML — the full HTML5 table (~2000 entries) is not reproduced:
 * what we cannot decode (`&colon;`, `&Tab;`, `&NewLine;`…), the browser
 * will decode anyway, so it is rejected below (`UNRESOLVED_ENTITY`) rather
 * than approximated here.
 */
function decodeEntities(value: string): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    if (value.charAt(i) !== "&") {
      out += value.charAt(i);
      i++;
      continue;
    }
    if (value.charAt(i + 1) === "#") {
      const numeric = decodeNumericEntity(value, i);
      if (numeric) {
        out += numeric.ch;
        i = numeric.end;
        continue;
      }
    } else {
      const end = value.indexOf(";", i + 1);
      const named = end === -1
        ? undefined
        : NAMED_ENTITIES.get(value.slice(i + 1, end));
      if (named !== undefined) {
        out += named;
        i = end + 1;
        continue;
      }
    }
    out += value.charAt(i);
    i++;
  }
  return out;
}

/*
 * The WHATWG URL parser strips leading/trailing C0-or-space and removes tab
 * and newline from anywhere before it ever reads a scheme — which is exactly
 * why "&#1;javascript:alert(1)" resolves to the javascript: scheme in a real
 * browser: the leading C0 control disappears and "javascript:" becomes the
 * front of the string. This file used to strip only tab/newline/CR, which
 * left the other 29 C0 values untouched and, in leading position, just as
 * exploitable. Reproducing the browser’s trim faithfully (leading/trailing
 * only, plus tab/newline anywhere, but nothing else in the middle) is a
 * second parsing algorithm to keep in sync with a moving spec — the same
 * trap this file already fell into once with CommonMark (round 2). A
 * legitimate URL never contains a raw control character at all, in any
 * position: rejecting the value outright the moment one survives decoding
 * closes the whole U+0000-U+001F range, in every position and every
 * spelling (numeric entity, hex entity, raw byte), without having to reason
 * about where the browser would or would not have trimmed it.
 */
function hasControlChar(value: string): boolean {
  for (const ch of value) {
    if (ch.charCodeAt(0) <= 0x1f) return true;
  }
  return false;
}

function isLowerAsciiLetter(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

function isSchemeChar(ch: string): boolean {
  return isLowerAsciiLetter(ch) || (ch >= "0" && ch <= "9") ||
    ch === "+" || ch === "-" || ch === ".";
}

/**
 * The scheme prefix of a URI (RFC 3986 §3.1): a letter, then
 * letters/digits/`+`/`-`/`.` up to the first `:`. Anything not of that shape
 * is no scheme at all—`./a:b` has a `:` inside a relative path. `null` means
 * “relative”, not “refuse this”.
 */
function schemeOf(value: string): string | null {
  const colon = value.indexOf(":");
  if (colon <= 0) return null;
  const candidate = value.slice(0, colon);
  if (!isLowerAsciiLetter(candidate.charAt(0))) return null;
  for (let i = 1; i < candidate.length; i++) {
    if (!isSchemeChar(candidate.charAt(i))) return null;
  }
  return candidate;
}

/*
 * Whatever survives decoding still shaped like a character reference — an
 * unknown named entity, or a numeric one out of the Unicode range — will be
 * decoded by the browser, not by us: reject by default, as with tags and
 * schemes. The numeric branch matches exactly what decodeNumericEntity can
 * consume, digits or hex digits after x: "&#" followed by anything else is
 * no reference for the browser either, so "?ref=twitter&#comment-42" is an
 * ordinary comment anchor and must pass. A lone "&" (query string) or one
 * followed by a name without a semicolon is not a complete reference and
 * passes too.
 */
const UNRESOLVED_ENTITY =
  /&(?:#(?:[xX][0-9a-fA-F]+|[0-9]+);?|[a-zA-Z][a-zA-Z0-9]*;)/;

function isAllowedUri(rawValue: string): boolean {
  const decoded = decodeEntities(rawValue);
  if (hasControlChar(decoded)) return false;
  const normalized = decoded.trim().toLowerCase();
  if (UNRESOLVED_ENTITY.test(normalized)) return false;
  const scheme = schemeOf(normalized);
  return scheme === null || ALLOWED_URI_SCHEMES.has(scheme);
}

/*
 * Analyses the RENDERED HTML, never the Markdown source: Bun.markdown.html()
 * has already settled what is code (span or block, escaped into text) and
 * what is a real node.
 *
 * What this guard guarantees: every tag of the produced HTML belongs to the
 * measured set of what legitimate Markdown/GFM can produce; no `on…`
 * attribute (event handler, on any tag); every `href`/`src` carries an http,
 * https or mailto scheme, or none at all (relative), once entities are
 * decoded — and is refused outright if any C0 control character
 * (U+0000-U+001F) survives that decoding, in any position, because a
 * leading one is exactly what a real browser trims before reading the
 * scheme, and no legitimate URL contains one anyway; and a character
 * reference this decoding does not resolve (named entity outside the five
 * of XML, numeric one out of the Unicode range) is refused, because the
 * browser would resolve it.
 *
 * What it does NOT guarantee: `URI_ATTRIBUTES` holds `href` and `src`, and
 * nothing else is examined as a URL carrier. The other attributes that also
 * carry one go through unexamined — measured: `srcset` on `img`, `cite` on
 * `blockquote`/`del`, `ping` on `a`, `background` on `td`, `formaction` on
 * the `input` a GFM task list renders. A review ran them through a real
 * Chrome: none executes. So it is a known and accepted blind spot rather
 * than a hole — but a blind spot it is, and this comment does not pretend
 * otherwise. Presentational attributes (`align`, `class`, `title`, `alt`,
 * `type`, `checked`…) open no execution or navigation path at all. This is
 * not a general HTML sanitizer: it is a fence around what a legitimate
 * Markdown article can produce, refusing everything else by default instead
 * of enumerating what to refuse.
 */
export function assertSafeHtml(html: string, path: string): void {
  let violation: string | undefined;

  // Bun’s HTMLRewriter handlers run synchronously for a string input (verified
  // empirically): there is no stream to consume, so `assertSafeHtml` stays a
  // synchronous function, like its caller.
  new HTMLRewriter().on("*", {
    element(el) {
      if (violation) return;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        violation = `<${el.tagName}>`;
        return;
      }
      for (const [name, value] of el.attributes) {
        if (isEventAttribute(name)) {
          violation = name;
          return;
        }
        if (URI_ATTRIBUTES.has(name) && !isAllowedUri(value)) {
          violation = `${name}="${value}"`;
          return;
        }
      }
    },
  }).transform(html);

  if (violation) {
    throw new Error(
      `${path}: forbidden HTML in an article source (${violation}). ` +
        "Articles are Markdown; executable HTML has no place in them.",
    );
  }
}

export function assertSafeMarkdown(source: string, path: string): void {
  assertSafeHtml(Bun.markdown.html(source), path);
}

export function slugifyHeading(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/*
 * A counter per base slug is not enough: “Notes” repeated twice yields notes
 * and then notes-2, but a literal heading “Notes 2” slugifies to notes-2 as
 * well—a silent collision, a duplicate id, a broken anchor. What has to be
 * tracked is the ids actually handed out, not the bases that led to them.
 */
function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  const id = `${base}-${suffix}`;
  used.add(id);
  return id;
}

export async function renderMarkdown(
  body: string,
  lang: Lang,
  // Optional, with a generic default: the original signature (body, lang)
  // stays valid for callers that have no article path (the tests). A real
  // caller from the content pipeline can supply the actual path and get an
  // error message worth acting on.
  path = "<markdown>",
): Promise<string> {
  const rendered = Bun.markdown.html(body);
  // Checks the HTML just produced, not the source: assertSafeHtml has no need
  // to render again (unlike assertSafeMarkdown, which starts from the source
  // and has nothing else).
  assertSafeHtml(rendered, path);

  // Bun’s HTMLRewriter does expose `el.onEndTag()`, but unlike the Cloudflare
  // API the brief drew on, calling it does not allow an attribute to be set
  // after the fact: the opening tag is already serialized by the time the
  // callback runs (`setAttribute` inside `onEndTag` then has no effect—
  // verified empirically). A heading’s id, however, depends on all of its
  // text, which is known only once the closing tag is reached. Hence the two
  // passes: the first collects each heading’s text in encounter order (a
  // local array, so it stays safe under Promise.all), the second sets the ids
  // from that collection while `element()` can still modify the opening tag.
  const headingTexts: string[] = [];
  await new HTMLRewriter()
    .on("h2, h3, h4", {
      element() {
        headingTexts.push("");
      },
      text(chunk) {
        const last = headingTexts.length - 1;
        headingTexts[last] = (headingTexts[last] ?? "") + chunk.text;
      },
    })
    .transform(new Response(rendered))
    .text();

  const usedIds = new Set<string>();
  let headingIndex = 0;
  // True when the page is NOT written in Chinese: only then is a CJK run a
  // change of language to declare (RGAA 8.7). On a zh* page Chinese is the
  // language of the page itself, and there is nothing to mark.
  const markCjk = !lang.startsWith("zh");
  // Nesting depth under <code> or <pre>. An ancestor’s `text` handler (p,
  // li…) also receives the text of its descendants, so a <code> nested in a
  // <p> would go through the CJK marking exactly like prose—decision: code is
  // not prose, inline or block, and a screen reader has nothing to gain from
  // a change of language on an identifier. `onEndTag` cannot modify ITS OWN
  // tag (see above), but its callback does fire at the right point in the
  // stream, before the text that follows: enough for a plain counter.
  let codeDepth = 0;

  return await new HTMLRewriter()
    .on("h2, h3, h4", {
      element(el) {
        const text = headingTexts[headingIndex++] ?? "";
        const base = slugifyHeading(text) || "section";
        el.setAttribute("id", uniqueId(base, usedIds));
      },
    })
    .on("code, pre", {
      element(el) {
        codeDepth++;
        el.onEndTag(() => {
          codeDepth--;
        });
      },
    })
    .on("a[href]", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        if (/^https?:\/\//i.test(href)) {
          el.setAttribute("rel", "noopener noreferrer");
        }
      },
    })
    .on("table", {
      element(el) {
        el.before('<div class="table-scroll">', { html: true });
        el.after("</div>", { html: true });
      },
    })
    .on("img", {
      element(el) {
        el.setAttribute("loading", "lazy");
        el.setAttribute("decoding", "async");
      },
    })
    // Every element that can hold prose, headings included down to h6. The
    // anchor pass above stops at h4 because that is as deep as a table of
    // contents goes; a screen reader has no such limit, and an unmarked
    // Chinese run in an h5 is read in the page’s voice like any other.
    .on("p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote", {
      text(chunk) {
        if (!markCjk || codeDepth > 0 || !CJK_RUN.test(chunk.text)) return;
        CJK_RUN.lastIndex = 0;
        chunk.replace(
          chunk.text.replace(
            CJK_RUN,
            (run) => `<span lang="zh-Hans">${run}</span>`,
          ),
          { html: true },
        );
      },
    })
    .transform(new Response(rendered))
    .text();
}
