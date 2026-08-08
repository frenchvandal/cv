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
 * Un span `…` ou un bloc ``` /~~~ clôturé est un exemple à citer, pas une
 * charge active : Bun.markdown.html() l'échappe de toute façon en <code>. Un
 * article qui documente une faille XSS doit pouvoir écrire <script> — on
 * neutralise donc tout ce qui est déjà entre backticks avant de chercher du
 * HTML dangereux, sous peine de refuser sa propre documentation.
 */
const FENCED_CODE =
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm;
const INLINE_CODE = /(`+)[^`\n]*?\1/g;

function stripCode(source: string): string {
  return source.replace(FENCED_CODE, " ").replace(INLINE_CODE, " ");
}

/** Balise dont la seule fonction est d'exécuter ou d'embarquer du contenu. */
const DANGEROUS_TAG = /<\s*(script|iframe|object|embed)\b/i;

/*
 * Un gestionnaire d'événement, mais seulement DANS une balise : « oneshot=1 »
 * en pleine phrase est un mot ordinaire, pas une attaque. Le `/` compte comme
 * séparateur au même titre que l'espace — <img/onerror=…> est du HTML valide,
 * la barre oblique n'y délimite rien pour un navigateur.
 */
const EVENT_ATTR = /<[a-z][a-z0-9-]*\b[^>]*[\s/]on[a-z]+\s*=/i;

/** Un lien ou une image dont la cible s'exécute au clic plutôt que de naviguer. */
const JS_URI = /\]\(\s*javascript:|(?:href|src)\s*=\s*["']?\s*javascript:/i;

export function assertSafeMarkdown(source: string, path: string): void {
  const scanned = stripCode(source);
  const match = DANGEROUS_TAG.exec(scanned) ?? EVENT_ATTR.exec(scanned) ??
    JS_URI.exec(scanned);
  if (match) {
    throw new Error(
      `${path}: HTML interdit dans une source d'article (${
        match[0].trim()
      }). ` +
        "Les articles sont du Markdown ; le HTML exécutable n'y a pas sa place.",
    );
  }
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
): Promise<string> {
  const rendered = Bun.markdown.html(body);

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
