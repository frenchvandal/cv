/*
 * Markdown → HTML, en deux temps.
 *
 * 1. `Bun.markdown.html()` fait le rendu GFM. Il est natif, donc le blog n'a
 *    aucune dépendance de rendu — mais il laisse passer le HTML brut, d'où le
 *    garde-fou ci-dessous.
 * 2. Une passe `HTMLRewriter` applique ce que le rendu ne fait pas : ancres de
 *    titres, `rel` sur les liens externes, tables défilables, images
 *    paresseuses, et le marquage RGAA des runs chinois.
 *
 * Le marquage CJK passe ici par le gestionnaire de nœuds texte, et non par une
 * expression régulière sur une chaîne échappée comme dans src/render.ts : il ne
 * peut donc structurellement pas atteindre un attribut ou un nom de balise.
 */

import type { Lang } from "../src/translations.ts";

/** CJK idéographique et ponctuation CJK — les runs qui doivent déclarer leur langue. */
const CJK_RUN = /[　-〿㐀-䶿一-鿿豈-﫿]+/g;

/*
 * Mesuré, pas mémorisé : ensemble des balises que Bun.markdown.html() produit
 * pour toute la syntaxe GFM que ce dépôt exerce (titres h1-h6, emphase,
 * fort, barré, code en ligne et en bloc, citations, listes simples,
 * numérotées et de tâches, tables avec alignement, liens dont les autoliens,
 * images, règle horizontale, saut de ligne dur). Un round précédent
 * bloquait des balises connues une par une (`script`, `iframe`…) ; un audit
 * a trouvé sept vecteurs qui n'y figuraient pas (`form`, `button`, `svg`…).
 * Une liste noire de balises est ouverte par construction — il suffit d'un
 * huitième vecteur non prévu. Cette liste est fermée dans l'autre sens :
 * tout ce qui n'y figure pas est refusé, connu ou non.
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

/** Attributs de navigation/chargement — les seuls où un schéma d'URI s'exécute. */
const URI_ATTRIBUTES = new Set(["href", "src"]);

/*
 * `href`/`src` fermés à leur tour : seuls http, https, mailto et le relatif
 * (pas de schéma) sont légitimes dans un article. Comme pour les balises,
 * fermer la liste évite de devoir connaître à l'avance chaque façon
 * d'écrire "javascript:" — entité HTML, tabulation, casse…
 */
const ALLOWED_URI_SCHEMES = new Set(["http", "https", "mailto"]);

/** HTMLRewriter normalise déjà les noms d'attribut en minuscules : un préfixe suffit. */
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
 * exploitable. Reproducing the browser's trim faithfully (leading/trailing
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
 * Le préfixe de schéma d'une URI (RFC 3986 §3.1) : une lettre puis
 * lettres/chiffres/+/-/. jusqu'au premier ':'. Ce qui n'a pas cette forme
 * n'est pas un schéma — "./a:b" a un ':' dans un chemin relatif, pas de
 * schéma. `null` veut dire "relatif", pas "à refuser".
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

  // Les handlers HTMLRewriter de Bun s'exécutent de façon synchrone pour une
  // entrée string (vérifié empiriquement) : pas de flux à consommer, donc
  // `assertSafeHtml` reste une fonction synchrone comme son appelante.
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
      `${path}: HTML interdit dans une source d'article (${violation}). ` +
        "Les articles sont du Markdown ; le HTML exécutable n'y a pas sa place.",
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
 * Un compteur par slug de base ne suffit pas : « Notes » répété deux fois
 * produit notes puis notes-2, mais un titre littéral « Notes 2 » slugifie
 * lui aussi en notes-2 — collision silencieuse, id dupliqué, ancre cassée.
 * Il faut donc suivre les ids réellement attribués, pas les bases qui y ont
 * mené.
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
  // Optionnel et par défaut générique : la signature d'origine (body, lang)
  // reste valable pour les appelants qui n'ont pas de chemin d'article (les
  // tests). Un vrai appelant du pipeline de contenu peut fournir le chemin
  // réel pour un message d'erreur exploitable.
  path = "<markdown>",
): Promise<string> {
  const rendered = Bun.markdown.html(body);
  // Vérifie le HTML qu'on vient de produire, pas la source : assertSafeHtml
  // n'a pas besoin de re-rendre (contrairement à assertSafeMarkdown, qui elle
  // part de la source et n'a que ça).
  assertSafeHtml(rendered, path);

  // Le HTMLRewriter de Bun expose bien `el.onEndTag()`, mais contrairement à
  // l'API Cloudflare dont le brief s'inspirait, l'appeler ne permet pas de
  // poser un attribut a posteriori : la balise ouvrante est déjà sérialisée
  // avant que le callback s'exécute (`setAttribute` dans `onEndTag` n'a alors
  // aucun effet — vérifié empiriquement). Or l'id d'un titre dépend de tout
  // son texte, connu seulement une fois la balise fermante atteinte. D'où les
  // deux passes : la première recueille le texte de chaque titre dans l'ordre
  // de rencontre (un tableau local, donc sûr sous Promise.all), la seconde
  // pose les ids en s'appuyant sur cette collecte pendant que `element()` peut
  // encore modifier la balise ouvrante.
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
  // Vrai quand la page n'est PAS écrite en chinois : c'est alors qu'un run CJK
  // est un changement de langue à déclarer (RGAA 8.7). Sur une page zh*, le
  // chinois est la langue de la page elle-même, il n'y a rien à marquer.
  const markCjk = !lang.startsWith("zh");
  // Profondeur d'imbrication sous <code> ou <pre>. Le handler `text` d'un
  // ancêtre (p, li…) reçoit aussi le texte de ses descendants, donc un
  // <code> niché dans un <p> passerait par le marquage CJK au même titre que
  // la prose — décision : du code n'est pas de la prose, ni en ligne ni en
  // bloc, un lecteur d'écran n'a rien à gagner à un changement de langue sur
  // un identifiant. `onEndTag` ne peut pas modifier SA PROPRE balise (voir
  // plus haut) mais son callback se déclenche bien au bon moment dans le
  // flux, avant le texte qui suit : suffisant pour un simple compteur.
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
    .on("p, li, td, th, h2, h3, h4, blockquote", {
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
