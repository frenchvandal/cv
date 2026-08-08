---
title: Mesurer le texte sans payer le reflow
date: 2025-09-12
summary: Pourquoi getBoundingClientRect impose une mise en page synchrone, et ce que change la mesure du texte hors du DOM.
tags: [typographie, bun]
---

## Le symptôme

Le profileur ne mentait pas : sur la page que je venais de livrer, Chrome
attribuait près d'un tiers du temps de trame à une ligne d'apparence innocente,
un appel à `getBoundingClientRect`. Je suis product owner de métier — un
business analyst qui écrit son code et peut donc vérifier ses soupçons lui-même
— et vingt ans de logiciel financier m'ont appris à me méfier des lignes
innocentes : c'est là que dorment les coûts.

Le mécanisme est documenté, et pourtant on l'oublie. Cette méthode doit
retourner une géométrie exacte à l'instant de l'appel. Or le moteur de rendu
travaille en différé : vos écritures de styles et de DOM s'accumulent dans une
file. Pour répondre juste, le navigateur doit vider cette file sur-le-champ —
recalculer les styles, puis la mise en page, en synchrone, pendant que votre
JavaScript attend. Une lecture après chaque écriture, dans une boucle sur une
trentaine d'entrées de menu, et vous obtenez ce que les Anglais appellent un
_layout thrashing_ : la trame entière part en recalculs que personne ne verra.

Le coût n'est donc pas dans l'appel, qui prend des microsecondes. Il est dans ce
qu'il déclenche : une mise en page complète, à un moment que vous n'avez pas
choisi.

## Mesurer sans toucher le DOM

Il existe une autre voie, et elle change davantage que la performance. Mesurer
un texte est au fond une opération pure : une chaîne, une police, un corps, et
une table de métriques. Rien de tout cela n'exige un élément. On prépare la
chaîne une fois, on obtient sa largeur par arithmétique, on met le résultat en
cache — et l'on peut même tester tout cela hors du navigateur, dans une suite de
tests unitaires ordinaire.

Les conséquences sont concrètes. D'abord, plus d'invalidation possible : la
mesure ne touche pas le document, elle ne peut donc pas le salir. Ensuite, le
résultat est connu avant le premier affichage : la page naît à la bonne taille
au lieu de se corriger devant le lecteur. Enfin, le coût devient lisible : il
est payé une fois, à la préparation, et non à chaque lecture.

Le prix, honnêtement : il faut mesurer avec la police réelle, donc attendre son
chargement, et le découpage en lignes devient votre affaire. Ce sont de vraies
contraintes — mais ce sont des contraintes de données, et les données se
testent.

## Ce que j'y gagne

Ce site, écrit à Chengdu où je suis installé, mesure son titre et sa navigation
avec [pretext](https://github.com/chenglou/pretext), qui prépare une fois puis
ne fait plus que de l'arithmétique. J'y retrouve le réflexe du rapprochement
comptable : un chiffre produit en synchrone par le moteur de mise en page est un
chiffre dont le coût se cache ailleurs dans le grand livre. Mesuré hors du DOM,
le même chiffre redevient une donnée — reproductible, testable, payée une seule
fois.
