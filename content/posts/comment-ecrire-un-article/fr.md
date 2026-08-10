---
title: Comment écrire un article
date: 2026-08-09
summary: Pourquoi les articles de ce site vivent en Markdown sur le disque, comment le build les rend sans dépendance, et le mode d’emploi pour en écrire un.
tags: [meta, web]
---

## Pourquoi du Markdown sur le disque

Le CV vit dans `src/translations.ts`, à côté des libellés de l’interface : un
document traduit à la main dans sept langues, chaque chaîne mesurée et ajustée
par le code. Un article est l’inverse — une longue prose, ni typée ni mesurée,
et il en arrivera d’autres. Je ne veux ni que le bundle grossisse à chaque
publication, ni qu’une coquille fasse échouer la compilation. Le contenu vit
donc sur le disque, lu par le build au pré-rendu. Le code reste le code, la
prose reste la prose.

## Le système de fichiers est la donnée

L’adresse d’un article tient en deux segments : le dossier est le slug, le
fichier la langue. `content/posts/comment-ecrire-un-article/fr.md` est la page
que vous lisez ; `en.md` à côté, sa version anglaise. Ni table de correspondance
ni registre : traduire, c’est déposer un fichier à côté ; retirer une langue,
c’est le supprimer. La règle — un article existe en une à n langues, chaque
index ne liste que ce qui existe dans la sienne — ne peut pas être violée par
oubli. Cet article en est la démonstration : il n’existe qu’en français et en
anglais — un lecteur espagnol ne le verra pas dans son index, et le sélecteur
mène à la traduction quand elle existe, sinon à l’index de la langue choisie,
jamais à un lien mort.

## Rendre sans dépendance

Le rendu est celui de `Bun.markdown`, moteur GFM natif : aucune dépendance de
rendu ajoutée. Deux temps : `Bun.markdown.html()` produit le HTML, puis
`HTMLRewriter` ajoute le reste — ancres de titres, `rel` sur les liens externes,
tables défilables, images paresseuses, marquage `lang` des passages chinois.

## L’anglais à la racine

L’anglais vit à la racine, chaque autre langue dans son dossier : `/blog/…` ici,
`/fr/blog/…` pour celle-ci. Les chemins d’assets, calculés depuis la profondeur
de la page, restent relatifs : `dist/` se dépose tel quel derrière n’importe
quel préfixe, sans reconstruire. Seules les URL du référencement reçoivent le
domaine au déploiement.

## Le garde-fou, ni plus ni moins

`Bun.markdown` laisse passer le HTML brut. Bloquer des balises une à une serait
une liste noire, ouverte par construction ; le build applique une liste blanche
fermée : seules les balises que du Markdown légitime produit passent, tout le
reste est refusé, connu ou non. Aucun attribut `on…`. Tout `href` ou `src`
relève de `http`, `https`, `mailto` ou du relatif, après décodage des entités et
retrait des caractères de contrôle qui déguiseraient un `javascript:` ; une
entité non résolue est refusée, puisque le navigateur la décoderait, lui.

Ce qu’il ne garantit pas : les attributs qui ne sont ni gestionnaires ni URL
passent sans examen. Pas un sanitizer général, mais une clôture sur ce qu’un
article peut produire — et cet article passe son propre filtre, c’est le
principe.

## Le manuel

Écrire un article, c’est créer un fichier :

```text
content/posts/<slug>/<lang>.md
```

Le slug assemble minuscules, chiffres et tirets. Des noms sont réservés parce
qu’ils désignent déjà un fichier du site : `assets`, `blog`, `cv`, `index`,
`404`, `robots`, `sitemap`, `feed`, `og-image`, et les codes de langue — un
article nommé `fr` écraserait le dossier de la langue.

Le frontmatter est une micro-grammaire stricte, pas du YAML : `title` et `date`
requis, le reste optionnel, toute clé inconnue ou dupliquée refusée en nommant
le fichier :

```text
---
title: Comment écrire un article
date: 2026-08-09
summary: Ce que l’article annonce, en une phrase.
tags: [meta, web]
---
```

Champ par champ : `date` est une vraie date `YYYY-MM-DD` — le 31 février est
refusé ; `summary`, absent, est déduit du texte ; `tags` prend la forme `[a, b]`
; `draft: true` exclut l’article sauf si `DRAFTS=1` ; `updated` date une
révision.

Pour lire l’article à sa vraie URL — le serveur de dev ne connaît pas celles du
blog :

```bash
bun run preview           # construit, puis sert sur http://localhost:4173
PORT=8080 bun run preview # autre port
DRAFTS=1 bun run preview  # brouillons inclus
```

Après toute écriture, une commande de plus :

```bash
bun run fonts:update
```

Elle re-sous-ensemble les polices Noto du site : un glyphe absent du
sous-ensemble s’affiche en tofu — une faute qu’on ne découvre que chez le
lecteur.

Enfin, la règle `zh-hk` : écrire `zh-hant.md` suffit — la version de Hong Kong
est projetée par le lexique, et un `zh-hk.md` explicite l’emporte. Les
conventions sèches vivent dans `AGENTS.md` ; cet article est le récit, ce
fichier la référence.
