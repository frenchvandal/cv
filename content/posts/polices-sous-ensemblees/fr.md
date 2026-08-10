---
title: Ne faire payer que les glyphes qu'on lit
date: 2026-02-08
summary: Sous-ensembler les polices woff2 et laisser unicode-range répartir la facture — et pourquoi un petit carré blanc est un signal d'alarme, pas un bug d'affichage.
tags: [typographie, performance]
---

## Une facture que personne ne lisait

Vingt ans de logiciel financier m'ont laissé un réflexe : quand un coût
n'apparaît sur aucune ligne, c'est qu'on le paie quand même — ailleurs, et sans
le savoir. Les polices web ont longtemps été ce genre de coût. On déclarait une
famille complète, le navigateur téléchargeait un fichier de plusieurs
mégaoctets, et l'on appelait cela soigner la typographie. Personne ne lisait la
facture ; elle passait dans le poids de la page.

Ce site fonctionne autrement. Chaque police y est découpée en sous-ensembles
woff2 : un fichier ne conserve que les glyphes réellement présents dans les
textes. Le latin tient en quelques kilo-octets ; le chinois, par nature, en
demande davantage. L'ordre de grandeur :

| Police       |    Script couvert    |   Taille |
| :----------- | :------------------: | -------: |
| Noto Sans    |        latin         |  ~ 14 ko |
| Noto Sans SC |  chinois simplifié   | ~ 130 ko |
| Noto Sans TC | chinois traditionnel | ~ 130 ko |
| Noto Sans HK | chinois de Hong Kong | ~ 135 ko |

## Le navigateur fait la répartition

La clause qui rend ce découpage honnête s'appelle `unicode-range`, dans la
déclaration `@font-face`. Elle annonce : ce fichier ne sert que pour telle plage
de caractères. Le navigateur compare les plages au texte de la page et ne
télécharge que ce qui correspond. Conséquence concrète : un lecteur anglais ne
recevra jamais un seul octet de chinois. Les fichiers CJK attendent sur le
serveur, prêts — mais pour lui, ils n'arrivent pas : une page latine n'atteint
jamais ces plages.

C'est, comptablement, le modèle que je défends depuis toujours en comité : la
répartition des coûts suit l'usage réel, pas l'usage imaginable. On ne refacture
pas le budget chinois au visiteur de Londres.

## Le tofu, signal d'alarme

Le sous-ensemblage a un revers, visible à l'œil nu. Si un caractère entre dans
les textes sans entrer dans le sous-ensemble, le navigateur n'a rien à dessiner
: il affiche le glyphe de remplacement, ce petit rectangle que les typographes
appellent tofu — d'après le japonais 豆腐, le bloc de soja caillé. Un seul
caractère oublié, et votre titre se décore d'un carré blanc.

Le tofu n'est donc pas un défaut d'affichage : c'est un signal. La copie a
changé, le sous-ensemble n'a pas suivi. La parade n'est pas un fichier plus gros
— ce serait revenir à la facture opaque — mais une discipline : régénérer les
sous-ensembles depuis les caractères effectivement présents dans les sources à
chaque changement de texte, et laisser un test le vérifier.

## Ce que j'y retrouve

Depuis Chengdu, où je suis installé, je lis ce mécanisme comme un grand livre
bien tenu : chaque visiteur paie ce qu'il lit, rien de plus, et tout écart entre
le texte et la fonte saute aux yeux. `unicode-range` est la clé de répartition ;
le tofu, le contrôle interne qui refuse de se taire.
