---
title: Dix ans à mesurer le texte dans le navigateur
date: 2026-07-30
summary: De getBoundingClientRect aux mesures hors du DOM — ce que dix ans de typographie web ont changé dans ma pratique, et ce qui n'a pas bougé d'un pixel.
tags: [typographie, rétrospective]
---

Il y a dix ans, j'ai mesuré du texte dans un navigateur pour la première fois de
ma carrière. Le besoin tenait en une phrase : faire tenir le nom d'un trader
dans l'en-tête d'un écran de suivi des positions, sans jamais le tronquer. La
solution de 2016 tenait en une ligne — un appel à `getBoundingClientRect` — qui
m'a coûté, au fil des ans, plus de journées de chasse aux bogues que n'importe
quelle formule de pricing. Cette rétrospective va de cette ligne aux mesures
hors du DOM que je pratique aujourd'hui, pour séparer ce que dix ans ont changé
de ce qui n'a pas bougé d'un pixel.

## La règle était dans le document

En 2016, mesurer du texte était un rituel. On créait un `span` invisible hors
écran, on y injectait la chaîne, on lisait sa largeur, puis on retirait
l'élément avant que quiconque ne s'aperçoive de rien. Personne ne questionnait
ce geste : c'était le prix d'une information que le navigateur gardait pour lui.

Le coût réel, je l'ai découvert dans un profileur. `getBoundingClientRect` doit
répondre juste à l'instant de l'appel ; or le moteur de rendu travaille en
différé : vos écritures s'accumulent dans une file. Pour répondre, le navigateur
vide cette file sur-le-champ : styles recalculés, mise en page synchrone,
pendant que votre JavaScript attend. Une lecture après chaque écriture, dans une
boucle de trente entrées de menu, et la trame part en recalculs invisibles.
Product owner de métier — un business analyst qui écrit son code —, je me méfie
des lignes innocentes depuis vingt ans de logiciel financier : c'est là que
dorment les coûts.

Le pire était fonctionnel : le nom tronqué en allemand, parce qu'une largeur
mesurée en anglais ne vaut rien pour « Geschäftsführer ». Nos rapports de bogues
typographiques se lisaient comme un atlas.

## L'intermède du canvas

Vers 2018, nous avons cru trouver la sortie : `measureText`, sur un contexte de
canvas. Plus de DOM, plus de reflow, une réponse en microsecondes. Nous y avons
gagné la vitesse et perdu la précision. La méthode rend des chasses, pas une
composition : ni césure ni retour à la ligne, un crénage variable selon les
moteurs, et une dépendance silencieuse à l'ordre de chargement des polices.
Mesuré trop tôt, le texte l'était dans une police de repli — et personne ne s'en
rendait compte avant la démonstration.

J'en garde une leçon qui dépasse la typographie : une mesure rapide mais fausse
est pire qu'une mesure lente, parce qu'elle inspire confiance. En finance, nous
dirions qu'elle passe les contrôles.

## La mesure sort du document

Le vrai tournant est venu plus tard, quand mesurer a cessé d'être une question
posée au document pour devenir une opération pure : une chaîne, une police, un
corps, une table de métriques. On prépare la chaîne une fois, on obtient les
largeurs par arithmétique, on met le résultat en cache. Le document n'entre plus
que pour afficher une réponse déjà connue.

Deux conséquences ont changé ma pratique. La page naît à la bonne taille, au
lieu de se corriger devant le lecteur. Et la mesure devient testable hors du
navigateur, dans une suite ordinaire — la mienne tourne sous Bun au moment du
build.

Les contraintes ont changé de nature : il faut la police réelle, donc attendre
`document.fonts.ready` ; le découpage en lignes devient votre affaire. Mais ce
sont des contraintes de données, et les données se testent. C'est le contrat que
j'attendais depuis vingt ans.

## Ce qui n'a pas changé

Dix ans, et le fond n'a pas bougé. Mesurer reste un acte typographique, pas un
exploit technique. L'allemand déborde toujours, le chinois ignore toujours les
espaces, et une césure mal placée reste une faute de goût dans les sept langues
de ce site. À Chengdu, textes latins et chinois se côtoient chaque jour sous mes
yeux : je n'ai plus besoin d'un rapport de bogue pour savoir que les règles de
coupure diffèrent — je le lis sur les menus des restaurants.

Autre constante : la mesure est un contrat avec le lecteur. Un nom tronqué dans
un rapport bancaire n'est pas un défaut cosmétique, c'est une faute contre la
confiance — comme un montant arrondi sans prévenir. C'est pourquoi je vérifie
ces chiffres de mes propres mains, avec le réflexe du rapprochement comptable :
un chiffre produit en synchrone par le moteur de mise en page est un chiffre
dont le coût se cache ailleurs dans les comptes.

## Ce que je garde

Les outils ont changé deux fois en dix ans ; la discipline, jamais. Mesurer avec
la police réelle. Ne jamais faire confiance à un chiffre dont on n'a pas vu le
coût. Payer une fois, à la préparation, et garder la lecture gratuite. Ce site
mesure son titre et sa navigation avec
[pretext](https://github.com/chenglou/pretext), qui prépare une fois puis ne
fait plus que de l'arithmétique : dix ans après ce premier
`getBoundingClientRect`, la règle n'est plus dans le document. Elle est dans les
données, où j'aurais dû la chercher dès 2016.
