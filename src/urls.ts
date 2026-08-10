/*
 * Où vit chaque page, et comment on va de l’une à l’autre.
 *
 * L’anglais est à la racine — ce que `langUrl` encodait déjà — et chaque autre
 * langue prend un dossier. La profondeur n’est donc plus uniforme, et tous les
 * chemins d’assets comme les liens inter-pages passent par `rel(depth)`. Ils
 * restent relatifs, donc le `dist/` se dépose à n’importe quel préfixe de
 * bucket : c’est l’invariant que le repo tient depuis le début.
 */

import type { Lang } from "./translations.ts";
import { LANGS } from "./translations.ts";

export type PageRef =
  | { kind: "home"; lang: Lang }
  | { kind: "cv"; lang: Lang }
  | { kind: "blogIndex"; lang: Lang }
  | { kind: "post"; lang: Lang; slug: string };

/**
 * Les noms qu’un slug ne peut pas prendre : ils désignent déjà un fichier ou un
 * dossier du site. Les codes de langue en font partie — un article « fr »
 * écraserait le dossier de la langue.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "assets",
  "blog",
  "cv",
  "index",
  "404",
  "robots",
  "sitemap",
  "feed",
  "og-image",
  ...LANGS,
]);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertSlug(slug: string, path: string): void {
  if (RESERVED_SLUGS.has(slug)) {
    throw new Error(`${path}: « ${slug} » est un nom réservé du site`);
  }
  if (!SLUG.test(slug)) {
    throw new Error(
      `${path}: slug invalide « ${slug} » — attendu [a-z0-9] séparés par des tirets`,
    );
  }
}

export function rel(depth: number): string {
  return depth === 0 ? "./" : "../".repeat(depth);
}

/** Le chemin du fichier dans `dist/`, sans barre oblique de tête. */
export function pagePath(ref: PageRef): string {
  const prefix = ref.lang === "en" ? "" : `${ref.lang}/`;
  switch (ref.kind) {
    case "home":
      return `${prefix}index.html`;
    case "cv":
      return `${prefix}cv.html`;
    case "blogIndex":
      return `${prefix}blog/index.html`;
    case "post":
      return `${prefix}blog/${ref.slug}.html`;
  }
}

/** Le nombre de dossiers entre la page et la racine du site. */
export function pageDepth(ref: PageRef): number {
  return pagePath(ref).split("/").length - 1;
}

/** Un lien relatif d’une page vers une autre, valable à n’importe quel préfixe. */
export function hrefTo(from: PageRef, to: PageRef): string {
  return `${rel(pageDepth(from))}${pagePath(to)}`;
}
