# Blog personnel avec section CV — design

Date : 2026-08-08 · Statut : validé, prêt pour le plan d'implémentation

## 1. Objectif

Transformer le site CV en blog personnel, le CV devenant une page parmi
d'autres. Le générateur reste un SSG écrit avec les fonctions natives de Bun, et
la sortie `dist/` est déposée sur Aliyun OSS depuis GitHub Actions.

Le point de départ n'est pas une page blanche : le site est **déjà** un SSG Bun
complet (`Bun.build` + `HTMLRewriter` dans
[scripts/build.ts](../../../scripts/build.ts)), avec sept langues, sitemap, JSON
Feed, image OG et 404. Ce design étend cet existant ; il n'en remplace aucune
partie saine.

## 2. Décisions arrêtées

| Question             | Décision                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| Langues des articles | 1..n par article ; l'index d'une langue ne liste que ce qui existe en elle |
| Page d'accueil       | Hero + derniers écrits ; le CV intégral passe sur `/cv`                    |
| Disposition          | Anglais à la racine, dossier par langue pour les six autres                |
| Déploiement          | `scripts/deploy.ts` en Bun pur, sans dépendance ajoutée                    |
| Justification        | Knuth–Plass étendu au balisage inline via un module `richtext.ts`          |
| Serveur de dev       | `bun run dev` inchangé (HMR conservé) + `bun run preview` sur `dist/`      |

## 3. Faits mesurés qui contraignent ce design

Chacun a été vérifié sur cette machine, avec Bun 1.3.14 et `@chenglou/pretext`
0.0.8. Ils ne sont pas des suppositions et ne doivent pas être re-dérivés.

1. **`Bun.markdown` existe** et expose `html`, `render`, `ansi`, `react`.
   `Bun.markdown.html()` rend du GFM (tables, `~~barré~~`, listes de tâches,
   blocs de code avec `class="language-*"`).
2. **`Bun.markdown.html()` ne retire pas le frontmatter** : il le rend en `<hr>`
   suivi d'un `<h2>`. Le découpage doit se faire en amont.
3. **`Bun.markdown.html()` laisse passer le HTML brut**, `<script>` compris.
4. **`Bun.markdown.render()` renvoie le texte brut** du Markdown — réutilisé
   pour les résumés, le feed et le sous-ensemblage des polices.
5. **`Bun.s3` ne peut pas poser de `Cache-Control` sur un `write()`** : ni une
   option `cacheControl`, ni un sac `headers` ne parviennent sur le fil. Les
   deux sont ignorés silencieusement.
6. **Un PUT présigné suivi d'un `fetch` porte les en-têtes voulus.** La
   signature est `AWS4-HMAC-SHA256` avec `X-Amz-SignedHeaders=host` seul : les
   en-têtes ajoutés ne peuvent donc pas l'invalider.
7. **`virtualHostedStyle: true` avec un endpoint sans bucket perd le bucket**
   (`https://oss-cn-x.aliyuncs.com/assets/x.js`). La forme correcte pour OSS met
   le bucket dans l'endpoint : `https://<bucket>.oss-<region>.aliyuncs.com`.
8. **`@chenglou/pretext/rich-inline` ne remplace pas Knuth–Plass.** Son API ne
   compose qu'une ligne à la fois (`layoutNextRichInlineLineRange`) et le bundle
   0.0.8 ne contient aucune gestion du tiret conditionnel : c'est du découpage
   glouton sans césure, soit l'algorithme que le navigateur applique déjà.

## 4. Modèle de contenu

### 4.1 Arborescence

Un dossier par article, un fichier par langue. Le nom du dossier **est** le slug
; le nom du fichier **est** la langue.

```
content/posts/
  mesurer-le-texte/
    fr.md
    en.md
  chengdu-2011/
    zh.md
```

Le système de fichiers porte la donnée : il n'y a pas de table de correspondance
à tenir, et la règle « 1..n langues » devient impossible à violer.

### 4.2 Frontmatter

> **Amendement du 2026-08-09.** Ce qui suit décrivait une grammaire maison,
> écrite parce qu'on croyait Bun sans parseur YAML. Il en a un :
> `Bun.YAML.parse`, natif. L'erreur d'origine n'était pas d'écrire du code,
> c'était de **confondre parsing et validation** — seule la validation méritait
> d'être écrite à la main, et elle reste. Un auteur écrit donc le YAML qu'il
> connaît déjà : commentaires, listes en bloc, valeurs multi-lignes. Mesuré sur
> les 63 titres du corpus, un seul cassait le parseur — un deux-points suivi
> d'une espace, qui doit être cité. Les règles de validation ci-dessous
> s'appliquent telles quelles.

Sous-ensemble volontairement minuscule, sans dépendance YAML :

```markdown
---
title: Mesurer le texte sans reflow
date: 2026-08-08
summary: Ce que pretext calcule, et ce qu'il ne calcule pas.
tags: [typographie, bun]
draft: false
---
```

Grammaire, appliquée strictement :

- le fichier commence par une ligne `---`, le bloc se ferme sur une ligne valant
  exactement `---` ;
- chaque ligne est `clé: valeur`, sans imbrication ni valeur multi-ligne ;
- les valeurs sont détourées ; une paire de guillemets englobants est retirée ;
- `tags` accepte la seule forme en ligne `[a, b, c]` ;
- `draft` accepte `true` ou `false`.

`title` et `date` sont obligatoires. Toute clé inconnue, clé dupliquée, date
malformée ou valeur manquante **casse le build**, avec le chemin du fichier dans
le message. Un `draft: true` est exclu du build sauf si `DRAFTS=1`.

### 4.3 Le type `Post`

```ts
interface Post {
  slug: string; // le nom du dossier
  lang: Lang;
  title: string;
  date: string; // YYYY-MM-DD
  updated?: string; // YYYY-MM-DD
  summary: string; // frontmatter, sinon dérivé du texte brut
  tags: readonly string[];
  body: string; // markdown, frontmatter retiré
  html: string; // rendu puis réécrit (§4.4)
  text: string; // Bun.markdown.render(body)
  sourcePath: string; // pour les messages d'erreur et le lastmod git
}
```

Les brouillons sont écartés à la découverte : un `Post` construit est un article
publiable, il n'a donc pas de champ `draft`.

### 4.4 Pipeline Markdown

`Bun.markdown.html(body)` puis une passe `HTMLRewriter` — l'idiome que
[build.ts](../../../scripts/build.ts) emploie déjà pour assembler les pages :

- `h2`–`h4` reçoivent un `id` slugifié, comme les sections du CV ;
- les liens externes reçoivent `rel="noopener noreferrer"` ;
- `table` est enveloppée dans un conteneur `overflow-x: auto` ;
- `img` reçoit `loading="lazy" decoding="async"` ;
- sur les pages non chinoises, les runs CJK sont marqués `lang="zh-Hans"` (RGAA
  8.7).

Ce dernier point est un gain de sûreté : `markChinese`
([render.ts:637](../../../src/render.ts#L637)) opère aujourd'hui par expression
régulière sur une chaîne déjà échappée. Passé par le gestionnaire de nœuds texte
d'`HTMLRewriter`, il ne peut structurellement plus atteindre un attribut ou un
nom de balise.

**Garde-fou.** Le fait mesuré nº 3 rend le HTML d'auteur transparent. Le build
refuse donc `<script`, `<iframe` et tout attribut `on…=` dans une source
d'article. Ce n'est pas un bac à sable — c'est un cran d'arrêt contre une faute
de frappe dans un fichier qu'on écrit soi-même.

> **Amendement du 2026-08-09.** La liste noire ci-dessus a été remplacée par une
> **liste blanche**, et pas par goût : elle a été contournée trois fois. Un
> audit externe a trouvé sept vecteurs qu'elle ne nommait pas (`form`, `button`,
> `svg`, `meta`…), puis une famille entière d'entités HTML (`&colon;`, `&Tab;`),
> puis les caractères de contrôle C0 en tête d'URI — ce dernier prouvé
> exécutable dans un vrai navigateur. Une liste noire est ouverte par
> construction : il suffit du huitième vecteur.
>
> Le garde-fou analyse désormais le **HTML rendu**, pas la source, et n'y
> autorise qu'un ensemble fini de balises et de schémas d'URI, mesuré sur ce que
> `Bun.markdown.html()` produit réellement. Tout le reste est refusé, connu ou
> non — y compris ce qui ressemble encore à une entité après décodage, plutôt
> que de reproduire les ~2000 entités nommées de HTML5.

## 5. Disposition des fichiers et URLs

L'anglais reste à la racine — ce que `langUrl` encode déjà (`en → ./`) — et
chaque autre langue prend un dossier.

```
index.html                          accueil EN, et seul fichier qui négocie
cv.html                             CV EN
blog/index.html                     index blog EN
blog/mesurer-le-texte.html          article EN
fr/index.html   fr/cv.html   fr/blog/index.html   fr/blog/mesurer-le-texte.html
…                                   idem pour pt, es, zh, zh-hant, zh-hk
assets/…                            bundle content-hashé
404.html  robots.txt  sitemap.xml  feed.json  feed.<lang>.json  og-image.png
```

La profondeur cesse d'être uniforme, donc les chemins d'assets sont calculés :

```ts
/** Préfixe relatif vers la racine du site depuis une page à cette profondeur. */
function rel(depth: number): string; // 0 → "./", 1 → "../", 2 → "../../"
```

Profondeurs : accueil EN et `cv.html` valent 0 ; `blog/*.html` et les pages
racine d'une autre langue valent 1 ; `<lang>/blog/*.html` vaut 2. Les chemins
restent relatifs, donc l'invariant du repo tient : le `dist/` se dépose à
n'importe quel préfixe de bucket.

**Slugs réservés**, refusés au build : `assets`, `blog`, `cv`, `index`, `404`,
`robots`, `sitemap`, `feed`, `og-image`, et tout code de langue.

**Négociation de langue.** Inchangée, et toujours sur `index.html` seul. Une URL
qui nomme une langue n'est jamais redirigée.

### 5.1 Rupture d'URL, assumée

Cette disposition **casse toutes les URLs de langue existantes** : `fr.html`
devient `fr/`, et le doublon anglais `en.html` disparaît au profit de la seule
racine. Le site changeant d'hébergeur dans la même opération, le moment est le
bon pour la payer une fois.

Le build émet donc, pour chaque ancienne URL, une **page-relais** à l'ancien
emplacement : `<link rel="canonical">` vers la nouvelle, un
`<meta
http-equiv="refresh" content="0; url=…">` et un lien cliquable pour les
lecteurs sans JS. Un stockage objet ne sait pas répondre 301 sans passer par le
CDN ; la page-relais est le seul mécanisme qui ne dépende d'aucune configuration
d'hébergeur. Elles sont marquées `noindex` et pourront être retirées d'ici un
an.

## 6. Rendu

### 6.1 Découpage des modules

[render.ts](../../../src/render.ts) fait 782 lignes et va grossir. Il se scinde
selon la seule frontière qui compte, celle du type de page :

- `src/render/shell.ts` — nav, sélecteur de langue, pied de page, `section()` ;
- `src/render/cv.ts` — les neuf sections actuelles, déplacées sans modification
  ;
- `src/render/blog.ts` — accueil, index blog, page d'article.

Toutes restent des fonctions pures rendant des chaînes, appelables sous Bun hors
navigateur. C'est la contrainte qui permet au build et au client de partager le
même rendu, et elle ne se négocie pas.

`src/render.ts` **subsiste** comme façade : il ré-exporte les trois modules
ainsi que les fonctions d'URL et de négociation (`langUrl`, `langFromPath`,
`pageLang`, `languageNegotiationScript`, `STORAGE_LANG_KEY`, `pageTitle`,
`NAV_LINKS`). Aucun de ses importateurs actuels —
[main.ts](../../../src/main.ts), [build.ts](../../../scripts/build.ts),
[feed.ts](../../../scripts/feed.ts),
[render.test.ts](../../../src/render.test.ts) — n'a donc à changer de chemin
d'import dans le même mouvement que le découpage.

`renderApp(lang, theme)` cède la place à :

```ts
type Page =
  | { kind: "home"; posts: readonly Post[] } // les derniers écrits
  | { kind: "cv" }
  | { kind: "blogIndex"; posts: readonly Post[] }
  | { kind: "post"; post: Post; translations: readonly Lang[] };

function renderPage(page: Page, lang: Lang, theme: Theme): string;
```

Le client n'appelle `renderPage` que pour `home` et `cv` (§6.2) ; `posts` lui
parvient par une petite charge JSON déjà présente dans le bundle, limitée aux
métadonnées des derniers écrits — jamais les corps d'articles.

### 6.2 Sélecteur de langue sur un article

Pour chaque langue : si l'article y existe, le lien mène à cette traduction ;
sinon il mène à l'index blog de cette langue, avec une mention en `.sr-only`
indiquant que l'article n'y est pas disponible. Jamais de lien mort, jamais de
page absente.

Le changement de langue **sans rechargement** reste sur l'accueil et `/cv`, où
les sept traductions sont déjà dans le bundle. Sur un article c'est une
navigation ordinaire : embarquer tous les corps d'articles côté client n'aurait
pas de sens.

### 6.3 Justification des articles

C'est le poste de travail principal de ce design.

`breakIntoLines` ([linebreak.ts](../../../src/linebreak.ts)) fait déjà le bon
calcul, et les motifs de césure existent pour les quatre langues latines. Mais
son appelant actuel termine par ([main.ts:294](../../../src/main.ts#L294)) :

```ts
p.innerHTML = lines.map((line) =>
  `<span class="kp-line">${escapeHtml(line)}</span>`
).join("");
```

Cela fonctionne parce qu'un paragraphe d'« À propos » est du texte nu. Un
paragraphe d'article contient `<em>`, `<strong>`, `<code>`, `<a href>` : branché
tel quel, l'enhancement **effacerait chaque lien et chaque emphase**, après le
premier paint et sans bruit. C'est une perte de contenu, pas une dégradation
esthétique.

**`src/richtext.ts`** (nouveau) fait remonter le balisage dans le pipeline :

```ts
interface Run {
  text: string;
  font: string; // police calculée de CE run
  letterSpacing: number;
  extraWidth: number; // padding + bordures horizontales du run
  ancestors: readonly InlineTag[]; // chaîne à rouvrir en début de ligne
}

/** Les runs d'un paragraphe, par parcours de ses nœuds texte. */
function runsFrom(el: HTMLElement): Run[];

/** Reconstruit le paragraphe en lignes, chaîne d'ancêtres rouverte par ligne. */
function renderLines(el: HTMLElement, lines: readonly Line[]): void;
```

Deux subtilités que `rich-inline` nomme explicitement et que ce module doit
traiter : **`extraWidth`** (un `<code>` inline a du padding et une bordure que
la mesure du texte ignore — sans quoi les lignes qui en contiennent débordent)
et l'**effondrement des espaces de frontière** (l'espace précédant `<em>` ne
doit pas être compté deux fois).

**`linebreak.ts`** change de signature, pas d'algorithme : `buildItems` accepte
des runs au lieu d'une chaîne et d'une police unique, chaque boîte retient son
run, et `toLines` renvoie des segments plutôt que des chaînes. L'optimiseur
Knuth–Plass lui-même n'est pas touché, et reste testable avec une mesure
injectée. La mesure par run est **déjà couverte** par
`pretextMeasure(letterSpacing)` : aucune API pretext nouvelle n'est requise.

**Consolidation.** « À propos » devient le cas dégénéré de ce chemin — un seul
run, aucun balisage. `enhanceAboutKp` disparaît au profit d'un
`enhanceJustified` unique servant les deux. On ne pose pas une seconde
implémentation à côté de la première.

### 6.4 Ordonnancement

Trois paragraphes dans « À propos » ; quarante dans un article. La boucle
actuelle est séquentielle avec un `await` par paragraphe, relancée en entier à
chaque redimensionnement — sur un article, elle bloquerait l'interaction et
ferait sauter la page en cours de lecture.

Un `IntersectionObserver` avec un `rootMargin` d'environ un écran compose chaque
paragraphe **avant** son entrée dans le champ. Le travail s'étale sur le
défilement, et les recompositions ayant lieu hors écran, le décalage de mise en
page reste proche de zéro — là où une passe globale au chargement ferait
sautiller quarante paragraphes d'une ligne chacun.

Au redimensionnement, seuls les paragraphes actuellement observés sont
recomposés. Les règles existantes tiennent : `whenFontsReady` avant toute
mesure, et abandon si `lang !== currentLang || !el.isConnected`.

### 6.5 Le chinois n'aura pas de Knuth–Plass

`breakIntoLines` renvoie `null` pour `zh`, `zh-hant` et `zh-hk` : il n'existe
pas de motifs de césure à charger. Ce n'est pas une lacune à combler. Un texte
chinois se coupe entre presque n'importe quels deux caractères, donc le
`text-align: justify` natif y donne déjà un bon résultat, là où il maltraite
l'anglais. Les articles chinois sont justifiés en CSS pur, et le design l'assume
au lieu de laisser croire à une parité.

### 6.6 Polices

[glyphs.ts](../../../scripts/glyphs.ts) scanne aussi `content/**/*.md`, via
`Bun.markdown.render()` qui en extrait le texte brut. Un article `fr` alimente
le sous-ensemble latin ; un `zh-hant`, le sous-ensemble TC ; un `zh-hk`, le
sien.

Les sous-ensembles CJK grandiront à chaque article chinois. Le build imprime la
taille de chaque `.woff2` pour que cette croissance reste visible plutôt que
subie. `fonts-coverage.test.ts` couvre également le texte des articles.

## 7. Build

[build.ts](../../../scripts/build.ts) reste l'orchestrateur et gagne :

1. la découverte du contenu par `Bun.Glob` sur `content/posts/*/*.md` ;
2. `rel(depth)` pour les chemins d'assets ;
3. l'émission des pages blog (accueil, index par langue, articles) ;
4. les feeds réécrits sur les articles ;
5. le sitemap étendu, avec un `lastmod` par article issu de `git log -1` sur son
   fichier source.

**Le feed change de nature, et c'est assumé.** L'en-tête de
[feed.ts](../../../scripts/feed.ts) pose aujourd'hui : « A CV is not a blog, so
the first question is what counts as an item ». Le site devient un blog ; les
articles sont les items, et ce commentaire est réécrit pour dire pourquoi. Les
entrées du CV quittent le feed : un abonné veut les écrits, pas la republication
d'un parcours.

Fonctions Bun employées : `Bun.build`, `HTMLRewriter`, `Bun.markdown.html`,
`Bun.markdown.render`, `Bun.Glob`, `Bun.file`, `Bun.write`, `Bun.$`,
`Bun.spawn`, `feature("PROD")` de `bun:bundle`, et `Bun.S3Client` au
déploiement.

## 8. Déploiement

`scripts/deploy.ts`, sans dépendance ajoutée, en quatre étapes.

1. **Jeton OIDC.** GitHub expose `ACTIONS_ID_TOKEN_REQUEST_URL` et
   `ACTIONS_ID_TOKEN_REQUEST_TOKEN` ; un `fetch` suffit — c'est tout ce que fait
   `@actions/core.getIDToken`.
2. **STS Aliyun.** `AssumeRoleWithOIDC` **ne demande aucune signature** : le
   jeton OIDC est lui-même l'authentification. C'est ce fait qui rend le
   zéro-dépendance viable.
3. **Upload.** `Bun.S3Client` avec les identifiants temporaires, endpoint
   `https://<bucket>.oss-<region>.aliyuncs.com` et `virtualHostedStyle: true`
   (fait nº 7), puis `presign({ method: "PUT" })` + `fetch` — le seul chemin
   mesuré capable de poser un `Cache-Control` (faits nº 5 et 6).
4. **Purge CDN.** HTML, feeds et sitemap uniquement, et seulement si
   `CDN_DOMAIN` est défini — sans lui l'étape est ignorée, sans erreur. C'est le
   seul appel du script qui exige la signature **propre à Aliyun** (RPC : tri
   des paramètres de requête, canonicalisation, HMAC-SHA1 avec la clé suffixée
   d'un `&`), et non SigV4. Une quarantaine de lignes, isolées dans leur propre
   module et testables sur les vecteurs de la documentation Aliyun sans réseau.
   C'est la partie la plus ingrate du chemin zéro-dépendance, et il faut le
   savoir avant de commencer. Les assets sont content-hashés : les purger
   n'aurait aucun sens.

### 8.1 Politique de cache

| Chemin                                    | `Cache-Control`                       |
| ----------------------------------------- | ------------------------------------- |
| `assets/*` (content-hashé)                | `public, max-age=31536000, immutable` |
| `*.html`                                  | `public, max-age=0, must-revalidate`  |
| `feed*.json`, `sitemap.xml`, `robots.txt` | `public, max-age=300`                 |
| `og-image.png`                            | `public, max-age=86400`               |

### 8.2 La synchronisation ne hache rien

Les assets portent déjà un hash dans leur nom : **même clé ⇒ même contenu**. Il
suffit donc de téléverser ceux dont la clé est absente du bucket. Tout le reste
— HTML, feeds, sitemap, robots, image OG — tient en quelques dizaines de petits
fichiers qu'on renvoie systématiquement.

Aucun MD5, aucune comparaison d'ETag, et donc aucune dépendance au fait qu'OSS
calcule ses ETags comme S3.

**L'ordre est load-bearing** : assets d'abord, HTML ensuite, suppressions en
dernier. Un lecteur ne peut ainsi jamais recevoir une page pointant vers un
asset pas encore téléversé.

Le planificateur est une **fonction pure** (liste locale + liste distante → plan
d'upload/conservation/suppression), donc testable sans réseau. `--dry-run`
imprime le plan sans rien écrire.

### 8.3 Configuration

Variables lues par le script : `OSS_BUCKET`, `OSS_REGION`, `OSS_ROLE_ARN`,
`OSS_OIDC_PROVIDER_ARN`, `SITE_URL`, et optionnellement `OSS_PREFIX`,
`CDN_DOMAIN`. Chaque valeur manquante fait échouer le script avec son nom, avant
tout appel réseau.

Le workflow gagne `permissions: id-token: write`, perd les étapes GitHub Pages,
et enchaîne `bun test`, `bun run build` (avec `SITE_URL`) puis `bun run deploy`.

## 9. Serveur de développement

- `bun run dev` — inchangé, **HMR conservé** : la coquille `index.html` pour le
  travail de style et de logique client.
- `bun run preview` — build puis serveur statique sur `dist/`, fidélité totale.
  C'est là qu'on vérifie les pages multilingues et les articles à leur vraie
  URL.

Le serveur de dev ne connaît pas les URLs du blog ; voir un article dans son
contexte réel passe par `preview`. C'est la seule limite, et elle est acceptée.

## 10. Tests

**`bun test`** couvre tout ce qui est pur :

- parseur de frontmatter : cas valide, clé inconnue, clé dupliquée, champ requis
  manquant, date malformée, `tags`, guillemets, `draft` ;
- pipeline Markdown : ids de titres, `rel` externe, enveloppe de table, `img`
  paresseuse, marquage CJK, rejet du HTML dangereux ;
- `rel(depth)`, construction des URLs, collision de slug réservé ;
- découverte du contenu : composition de l'index par langue, exclusion des
  brouillons ;
- `linebreak.ts` sur des runs multi-polices synthétiques, avec mesure injectée ;
- assemblage des lignes de `richtext.ts` à partir de segments synthétiques ;
- planificateur de déploiement : listes locale et distante → plan attendu, et
  ordre assets → HTML → suppressions ;
- signature RPC Aliyun, sur les vecteurs d'exemple de la documentation ;
- pages-relais : une par ancienne URL, canonical correct, `noindex` présent ;
- feed et sitemap : extension des tests existants.

**Vérifications au navigateur** (playwright-core + Chrome système, déjà en
place) :

- copier-coller à travers les lignes `.kp-line` — risque de mots collés ;
- recherche dans la page à travers une coupure de ligne ;
- CLS réel sur un article long ;
- aucun lien ni emphase perdus après justification ;
- hydratation sans flash sur une page d'article ;
- `runsFrom` sur du vrai DOM, que `bun test` ne peut pas exercer.

## 11. Risques

1. **SigV4 d'OSS sur un PUT présigné avec en-têtes non signés.** Cohérent par
   construction (fait nº 6), mais non vérifié sur le vrai bucket. Le plan
   d'implémentation **commence** par un aller-retour réel contre OSS. Si OSS
   refuse, le repli est le SDK Aliyun pour le seul upload ; le reste du design
   ne bouge pas.

   **Arbitrage du propriétaire (2026-08-08), qui prime sur le zéro-dépendance du
   §8 :** le SDK Aliyun officiel, dans sa version TypeScript la plus récente,
   est autorisé dès lors qu'écrire la signature à la main s'avère trop coûteux.
   Cela vise en premier la **purge CDN**, seul appel qui exige la signature RPC
   propre à Aliyun (HMAC-SHA1, canonicalisation, clé suffixée d'un `&`) et non
   SigV4 — le morceau le plus ingrat du chemin zéro-dépendance. Le plan C
   présentera les deux options avec leur coût mesuré plutôt que d'en trancher
   une d'avance ; la décision reste au propriétaire, paquet par paquet.

   L'upload lui-même n'est pas concerné tant que le fait nº 6 tient : `Bun.s3`
   plus un `fetch` présigné n'a besoin d'aucun SDK.
2. **Les trois effets du découpage en lignes** (copie, recherche, CLS) sont
   tolérables sur trois paragraphes et exposés par un article entier. Ils se
   mesurent (§10) et ne seront pas traités comme acquis.
3. **Croissance des sous-ensembles CJK** à chaque article chinois. Rendue
   visible par le rapport de taille au build, pas résolue.
4. **`Bun.markdown` fige le comportement GFM sur la version de Bun.** Une montée
   de version peut changer le HTML produit ; les tests du pipeline le
   détecteront.

## 12. Hors périmètre

Volontairement absents de cette itération, pour ne pas gonfler un premier jet :
pages de tags, archives, recherche, commentaires, pagination, RSS/Atom (le JSON
Feed suffit), temps de lecture, articles liés, déploiements de prévisualisation
pour les brouillons.

**Les images d'articles** sont le manque le plus probable à combler ensuite. Le
point d'extension naturel : `content/posts/<slug>/*.{png,jpg,svg}` copiés vers
`assets/` avec un hash, et les `src` réécrits dans la passe `HTMLRewriter` du
§4.4. Rien dans ce design ne s'y oppose.
