---
title: Bun comme générateur de site statique
date: 2026-01-15
summary: Vingt ans de chaînes de build dans la finance m’ont appris à me méfier des dépendances. Ce site est produit par Bun.build, HTMLRewriter et une boucle de pré-rendu, sans une seule dépendance de build.
tags: [bun, ssg]
---

Vingt ans dans le logiciel financier vous laissent des réflexes. Le mien
consiste à compter les dépendances avant de compter les fonctionnalités. J’ai
repris trop de chaînes de build dont la moitié des paquets n’avait plus de
mainteneur et dont personne ne savait plus pourquoi elles étaient là. Quand j’ai
reconstruit mon CV en ligne, la règle était donc fixée avant la première ligne
de code : zéro dépendance de build. Pas de Vite, pas de Webpack, pas de plugin
maintenu en vie par la bonne volonté d’un inconnu.

## Trois capacités, pas une de plus

Bun rend cette règle tenable. Trois de ses capacités suffisent à produire un
site complet.

La première est `Bun.build`, le bundler natif. Un point d’entrée, un dossier de
sortie, la minification : en quelques options, TypeScript et CSS sont compilés,
et les noms de fichiers reçoivent leur empreinte de cache. Pas de configuration
à apprivoiser, pas de graphe de plugins à déboguer un vendredi soir.

La deuxième est `HTMLRewriter`, l’API de transformation de HTML popularisée par
Cloudflare Workers et implémentée nativement par Bun. C’est elle qui injecte
dans l’en-tête du document les balises SEO, les liens `alternate`/`hreflang` et
le script de négociation de langue — au moment du build, jamais au runtime.

La troisième est la plus banale et la plus décisive : Bun exécute TypeScript
directement. Ma fonction de rendu est pure — elle produit une chaîne de
caractères sans toucher au DOM —, donc le build l’appelle une fois par langue et
écrit le résultat avec `Bun.write`. Sept langues, huit pages : l’anglais sert de
page racine et existe aussi sous son propre nom.

Le cœur du pré-rendu tient dans cette boucle :

```ts
import { renderApp } from "./src/render";
import { LANGS } from "./src/translations";

const result = await Bun.build({
  entrypoints: ["./src/main.ts", "./src/styles.css"],
  outdir: "./dist/assets",
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, "bundle failed");

for (const lang of LANGS) {
  const html = renderApp(lang); // pure string output, no DOM involved
  const page = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `<link rel="alternate" hreflang="${lang}" href="./${lang}.html">`,
          { html: true },
        );
      },
    })
    .transform(html);
  const name = lang === "en" ? "index.html" : `${lang}.html`;
  await Bun.write(`dist/${name}`, page);
}
```

## Le bilan, et ses limites

En tant que product owner, ce qui compte n’est pas l’élégance mais le bilan.
Build complet en moins d’une seconde sur mon portable. Un `dist/` entièrement
statique, aux chemins relatifs, déployable tel quel sur GitHub Pages ou
n’importe quel hébergeur, sous n’importe quel chemin de base. Une CI qui
n’installe rien d’autre que Bun. Et surtout un pipeline que je peux expliquer en
cinq minutes à un développeur qui découvre le projet — essayez ça avec une
configuration Webpack de 2019.

Soyons honnête sur les limites. Bun n’est ni Astro ni Eleventy : pas de
collections, pas de shortcodes, pas d’écosystème de thèmes. Tout ce qui dépasse
son périmètre — sitemap, flux JSON, métadonnées sociales — se code à la main.
C’est précisément le contrat que j’ai signé : après deux décennies passées à
reprendre des systèmes que personne ne comprenait plus en entier, je préfère un
outil qui fait peu, et dont je comprends tout.

À Chengdu, où je vis, la métaphore s’impose : c’est la différence entre une
cuisine pleine de robots et un bon couteau. Le couteau ne fait pas tout. Mais il
ne tombe jamais en panne un vendredi soir.
