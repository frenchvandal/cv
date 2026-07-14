# Proposition de design — Philippe Ribeiro

> **Statut (juillet 2026) : proposition historique, non retenue telle quelle.**
> Le site implémenté a gardé le layout 2 colonnes / titres sticky / fade-up, mais
> avec Noto Sans (multilingue, requis par la mesure pretext), l'accent indigo
> `#6366f1` et un fond `#0a0a0a` — pas Space Grotesk ni le noir absolu, et pas
> d'anneau orbital (les « orbs » de la section À propos en sont l'écho ludique).
> Conservé comme référence d'intention visuelle.

## Inspiration
Le site de [Moonshot AI](https://www.moonshot.ai) repose sur une esthétique **cosmos / noir absolu / luxe tech** :
- fond `#000000` profond,
- typographie fine et aérée,
- un élément central lumineux (planète / éclipse),
- composants arrondis, presque flottants,
- très peu de couleurs, beaucoup de silence visuel.

L'idée est de transposer cette atmosphère à un CV : un portfolio qui ne crie pas, qui respire, et qui laisse la place au contenu.

---

## Direction créative : "Orbital CV"

Le CV devient une **page unique en scroll vertical**, comme un trajet orbital :
1. **Lancement** — hero avec nom et accroche.
2. **Atmosphère** — about / stats.
3. **Trajectoire** — expérience.
4. **Formation** — éducation.
5. **Capteurs** — skills.
6. **Contact** — footer CTA.

### Motif visuel
Un **anneau / orbite fine** en arrière-plan, légèrement animé (rotation très lente, CSS only). Il rappelle l'éclipse de Moonshot sans la copier. Sur mobile, il devient un simple halo radial.

---

## Palette

| Rôle | Dark | Light |
|------|------|-------|
| Fond principal | `#000000` | `#fafafa` |
| Fond élevé | `#0a0a0a` | `#ffffff` |
| Surface | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` |
| Texte principal | `#f2f2f2` | `#111111` |
| Texte secondaire | `#9ca3af` | `#52525b` |
| Texte tértiaire | `#52525b` | `#a1a1aa` |
| Accent | `#ffffff` (dark) / `#111111` (light) | — |
| Accent secondaire | `#6366f1` | `#4f46e5` |
| Bordure | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` |

Le blanc devient l'accent principal en dark mode, créant un contraste Moonshot-like. L'indigo reste comme point de chaleur (hover, badges actifs).

---

## Typographie

- **Display / titres** : `Space Grotesk` (Google Fonts) — géométrique, large, moderne.
- **Corps** : `Inter` ou garder `Noto Sans` pour le multilingue.
- **Mono** : `JetBrains Mono` pour les labels, dates, tags.

Hiérarchie :
- Nom hero : `clamp(3rem, 12vw, 9rem)`, weight 500, letter-spacing `-0.04em`
- Titres de section : `clamp(2rem, 5vw, 4rem)`, weight 500
- Corps : `1rem`, weight 400, line-height `1.6`
- Labels mono : `0.7rem`, uppercase, letter-spacing `0.15em`

---

## Layout

### Hero
- Pleine hauteur (`min-height: 100dvh`), centré verticalement.
- Nom en deux lignes, très large, aligné à gauche sur desktop, centré sur mobile.
- Sous-titre fin en dessous, max-width `34rem`.
- Un **anneau orbitale** SVG en arrière-plan, centré derrière le nom, opacity `0.12`.
- Deux boutons arrondis style Moonshot : outline blanche, fond transparent, `border-radius: 999px`.

### Sections
- Chaque section occupe toute la largeur avec du padding généreux (`6rem` verticales).
- Titres sticky à gauche, contenu à droite (2 colonnes sur desktop).
- En dark mode, les cartes ont un fond `rgba(255,255,255,0.03)` avec une bordure très subtile.
- Hover des cartes : légère élévation + bordure blanche plus visible.

### Skills
- Affichage en "cloud" de tags arrondis (pill shape) plutôt que des blocs carrés.
- Les tags ont un fond très sombre et une bordure subtile.

### Contact
- Grand bloc central avec un CTA email très visible.
- Lien email en `clamp(1.25rem, 4vw, 3rem)`, underline animé.

---

## Effets & animations

1. **Anneau orbital**
   - SVG avec deux cercles elliptiques.
   - Animation CSS `rotate` lente (60s/tour).
   - `mix-blend-mode: screen` ou simple stroke blanc à 8% d'opacité.

2. **Entrées en fade-up**
   - Garder l'existant (`fade-up`) mais avec une courbe plus douce.
   - Délais en cascade sur le hero.

3. **Glow subtil**
   - Derrière le nom, un radial-gradient blanc très faible qui pulse très lentement (optionnel).

4. **Hover des liens**
   - Underline qui grandit de gauche à droite.

5. **Réduction de mouvement**
   - Toutes les animations respectent `prefers-reduced-motion`.

---

## Composants clés

### Boutons Moonshot-style
```css
.button--outline {
  border: 1px solid rgba(255,255,255,0.25);
  background: transparent;
  color: #f2f2f2;
  border-radius: 999px;
  padding: 0.75rem 1.5rem;
  transition: all 0.25s ease;
}
.button--outline:hover {
  border-color: #fff;
  background: rgba(255,255,255,0.08);
}
```

### Carte de section
```css
.card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 1rem;
  padding: 1.5rem;
}
```

### Badge pill
```css
.tag {
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  padding: 0.35rem 0.85rem;
}
```

---

## Pourquoi ce design fonctionne pour un CV

- **Silence visuel** = autorité et confiance.
- **Contraste extrême** en dark mode = mémorable.
- **Animations légères** = sensation de qualité sans distraction.
- **Structure en 2 colonnes** = scan rapide pour un recruteur.
- **Facile à imprimer / PDF** : on peut générer une version sans l'orbite et avec fond blanc.

---

## Options possibles

1. **Version "Deep Space"** (recommandée) : noir absolu, anneau orbital, typographie Space Grotesk.
2. **Version "Lunar Light"** : même layout, mais fond très clair avec accents noirs.
3. **Version "Nébuleuse"** : ajout de dégradés violets/bleus subtils derrière le hero.
