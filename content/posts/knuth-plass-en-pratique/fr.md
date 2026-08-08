---
title: Knuth–Plass en pratique, ou la justification bien comprise
date: 2025-11-21
summary: Vingt ans de logiciel financier m'ont rendu allergique aux approximations. Ce que l'algorithme de Knuth–Plass change dans la justification d'un paragraphe, et pourquoi shrink: 0 quand CSS ne sait qu'étirer les espaces.
  tags: [typographie, algorithmes]
---

Je passe mes journées à lire des documents de spécification interminables —
exigences réglementaires, rapports d'audit, notes de cadrage. C'est le métier :
vingt ans de product ownership et de business analysis dans le logiciel
financier, entre l'Europe et Chengdu où je suis installé, vous rendent
allergique aux approximations. La typographie du navigateur en est une, et elle
m'a agacé longtemps sans que je sache nommer le problème.

Le problème a un nom : l'algorithme glouton. Quand un navigateur justifie un
paragraphe (`text-align: justify`), il remplit les lignes une à une, dans
l'ordre, et s'arrête au premier mot qui ne rentre plus. Puis il étire les
espaces de cette seule ligne jusqu'à la marge droite. Chaque ligne est
localement acceptable, et l'ensemble est un désastre : une ligne aux blancs
béants succède à une ligne tassée, et l'œil du lecteur trébuche à chaque retour.

Knuth et Plass ont publié l'alternative en 1981, pour TeX : traiter le
paragraphe comme un tout. Le texte devient une suite de boîtes (les mots), de
colle (les espaces, qui peuvent s'étirer ou se rétracter dans des bornes
déclarées) et de pénalités (les points de césure). L'algorithme examine toutes
les suites de coupures possibles et retient celle qui minimise les démérites
cumulés du paragraphe entier. Une coupure médiocre pour sa ligne peut être la
bonne si elle débloque les trois suivantes. Le glouton optimise le trimestre ;
l'optimal optimise le plan à cinq ans.

La césure est ce qui donne de l'espace de manœuvre à l'optimiseur. Chaque point
de coupure syllabique — les motifs de Liang, dans mon cas — est une position
candidate de plus, donc moins d'étirement forcé. Sans césure, la coupure
optimale reste supérieure au glouton sur du texte latin, mais les colonnes
étroites la laissent sans options.

Le détail qui m'a coûté le plus long à comprendre, c'est `shrink: 0`. Dans le
modèle TeX, la colle peut se comprimer, parce que TeX sait réellement rendre des
espaces comprimés. CSS ne le sait pas : un navigateur élargit les espaces, il ne
les rétrécit jamais. Laisser le solveur utiliser la compression, c'est obtenir
des solutions que le moteur de rendu ne peut pas honorer — des lignes censées
rentrer qui débordent. On fixe donc le retrait à zéro, et l'optimiseur ne
propose que ce que CSS peut tenir. Une contrainte d'implémentation remontée dans
le modèle, là où les contraintes devraient toujours se trouver. Après vingt ans
de spécifications, j'aimerais voir ce réflexe plus souvent.

L'exercice qui m'a convaincu : de longs paragraphes de prose continue, presque
sans balisage — le cas le plus ingrat, et le plus courant dans mes documents. À
largeur de colonne égale, la version gloutonne laisse des trous visibles ; la
version optimale se lit, tout simplement. C'est tout ce qu'on demande à une
infrastructure : qu'elle se fasse oublier.
