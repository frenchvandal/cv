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

/** Ce qu'un article ne doit jamais contenir : exécutable ou cadre embarqué. */
const DANGEROUS = /<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=/i;

export function assertSafeMarkdown(source: string, path: string): void {
  const match = DANGEROUS.exec(source);
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

  const seen = new Map<string, number>();
  let headingIndex = 0;
  // Vrai quand la page n'est PAS écrite en chinois : c'est alors qu'un run CJK
  // est un changement de langue à déclarer (RGAA 8.7). Sur une page zh*, le
  // chinois est la langue de la page elle-même, il n'y a rien à marquer.
  const markCjk = !lang.startsWith("zh");

  return await new HTMLRewriter()
    .on("h2, h3, h4", {
      element(el) {
        const text = headingTexts[headingIndex++] ?? "";
        const base = slugifyHeading(text) || "section";
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        el.setAttribute("id", count === 1 ? base : `${base}-${count}`);
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
        if (!markCjk || !CJK_RUN.test(chunk.text)) return;
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
