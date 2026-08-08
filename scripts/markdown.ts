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
 * Une référence de caractère (`&#106;`, `&#x6A;`) encode n'importe quel
 * caractère lettre par lettre — c'est le vecteur mesuré dans l'audit
 * (`&#106;avascript:`). Les cinq entités nommées XML couvrent le reste de ce
 * qui apparaît plausiblement dans une URL ; la table HTML5 complète
 * (~2000 entités) n'ajouterait rien ici, un attaquant qui sait écrire
 * `&colon;` sait tout aussi bien écrire `&#58;`.
 */
function decodeEntityBody(body: string): string | null {
  if (body.startsWith("#x") || body.startsWith("#X")) {
    const code = Number.parseInt(body.slice(2), 16);
    return Number.isNaN(code) ? null : String.fromCodePoint(code);
  }
  if (body.startsWith("#")) {
    const code = Number.parseInt(body.slice(1), 10);
    return Number.isNaN(code) ? null : String.fromCodePoint(code);
  }
  return NAMED_ENTITIES.get(body) ?? null;
}

function decodeEntities(value: string): string {
  let out = "";
  let i = 0;
  while (i < value.length) {
    const ch = value.charAt(i);
    if (ch !== "&") {
      out += ch;
      i++;
      continue;
    }
    const end = value.indexOf(";", i + 1);
    const decoded = end === -1
      ? null
      : decodeEntityBody(value.slice(i + 1, end));
    if (decoded === null) {
      out += ch;
      i++;
    } else {
      out += decoded;
      i = end + 1;
    }
  }
  return out;
}

/** Ce qu'un navigateur retire d'une URL avant de la parser (WHATWG URL,
 * « remove all ASCII tab or newline ») — inséré au milieu d'un schéma, ça le
 * rend méconnaissable à une simple recherche de sous-chaîne. */
function stripUrlControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch !== "\t" && ch !== "\n" && ch !== "\r") out += ch;
  }
  return out;
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

function isAllowedUri(rawValue: string): boolean {
  const normalized = stripUrlControlChars(decodeEntities(rawValue))
    .trim()
    .toLowerCase();
  const scheme = schemeOf(normalized);
  return scheme === null || ALLOWED_URI_SCHEMES.has(scheme);
}

/*
 * Analyse le HTML déjà RENDU, jamais la source Markdown : Bun.markdown.html()
 * a déjà tranché ce qui est du code (span ou bloc, échappé en texte) et ce
 * qui est un noeud réel.
 *
 * Ce que ce garde-fou garantit : toute balise du HTML produit appartient à
 * l'ensemble mesuré de ce que du Markdown/GFM légitime peut produire ;
 * aucun attribut `on…` (gestionnaire d'événement, quelle que soit la
 * balise) ; tout `href`/`src` a un schéma http, https, mailto ou aucun
 * (relatif), après décodage des entités et retrait des caractères de
 * contrôle qui pourraient le déguiser.
 *
 * Ce qu'il ne garantit PAS : les attributs qui ne sont ni `on…` ni
 * `href`/`src` passent sans examen (`align`, `class`, `title`, `alt`,
 * `type`, `checked`…) — aucun n'ouvre, dans les balises autorisées, de
 * chemin d'exécution ou de navigation. Ce n'est pas un sanitizer HTML
 * général : c'est une clôture sur ce qu'un article Markdown peut
 * légitimement produire, qui refuse tout le reste par défaut plutôt que
 * d'énumérer ce qu'il faut refuser.
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
