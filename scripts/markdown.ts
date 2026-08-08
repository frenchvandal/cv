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

/** Balises dont la seule fonction est d'exécuter ou d'embarquer du contenu. */
const DANGEROUS_TAGS = new Set(["script", "iframe", "object", "embed"]);

/** Attributs de navigation/chargement — les seuls où une URI javascript: s'exécute. */
const URI_ATTRIBUTES = new Set(["href", "src"]);

/** HTMLRewriter normalise déjà les noms d'attribut en minuscules : un préfixe suffit. */
function isEventAttribute(name: string): boolean {
  return name.startsWith("on");
}

/** Tolérant à la casse et aux espaces d'encadrement, comme le serait un navigateur. */
function isJavascriptUri(value: string): boolean {
  return value.trim().toLowerCase().startsWith("javascript:");
}

/*
 * Analyse le HTML déjà RENDU, jamais la source Markdown. Une regex sur la
 * source doit réimplémenter la grammaire CommonMark pour savoir si un
 * backtick est échappé, si une fence est indentée sous une citation, etc. —
 * une course perdue d'avance contre un vrai parseur. Bun.markdown.html() a
 * déjà tranché : il échappe tout ce qui est du code (span ou bloc) en texte
 * littéral, donc un <script>, un attribut on…= ou une URI javascript: qui
 * survit ici comme un vrai nœud est exactement, et uniquement, ce qui est
 * dangereux.
 */
export function assertSafeHtml(html: string, path: string): void {
  let violation: string | undefined;

  // Les handlers HTMLRewriter de Bun s'exécutent de façon synchrone pour une
  // entrée string (vérifié empiriquement) : pas de flux à consommer, donc
  // `assertSafeHtml` reste une fonction synchrone comme son appelante.
  new HTMLRewriter().on("*", {
    element(el) {
      if (violation) return;
      if (DANGEROUS_TAGS.has(el.tagName)) {
        violation = `<${el.tagName}>`;
        return;
      }
      for (const [name, value] of el.attributes) {
        if (isEventAttribute(name)) {
          violation = name;
          return;
        }
        if (URI_ATTRIBUTES.has(name) && isJavascriptUri(value)) {
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
