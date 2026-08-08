---
title: Pourquoi ce site parle sept langues
date: 2025-10-03
summary: Une page par langue, écrite pour son public, jamais de traduction automatique: ce que vingt ans de logiciel financier et un 微辣 à Chengdu m'ont appris.
  tags: [multilinguisme, web]
---

Après vingt ans dans le logiciel financier — d'abord business analyst, puis
product owner — j'ai appris à me méfier des exigences qui tiennent en une
phrase. « Le site doit être multilingue » en est une. En apparence, une case à
cocher. En réalité, une décision d'architecture, un choix éditorial et une
promesse faite au lecteur.

## Une page par langue

Ce site parle sept langues : anglais, français, portugais, espagnol, et trois
déclinaisons de chinois — 简体字 pour le continent, 繁體字 pour Taïwan, plus une
projection pour Hong Kong. Chaque langue est une page statique complète, générée
à l'avance. Il n'y a pas de machine à traduire entre vous et moi : ni API de
traduction au chargement, ni JavaScript qui réécrit la page pendant que vous la
lisez. Quand vous lisez la version française, chaque phrase a été écrite pour
vous, pas convertie depuis l'anglais.

Pourquoi cette exigence ? Parce que je vis à Chengdu, et que le chinois m'a
offert la meilleure métaphore de ma carrière. Au restaurant, je commande 微辣 —
« légèrement piquant ». Le dictionnaire traduit mildly spicy : littéral,
correct, inutilisable. Le 微辣 d'ici est une échelle locale, une convention
entre le cuisinier et le client. La traduction automatique rend les mots et perd
la convention, à tous les coups.

## La langue fait partie de la logique

J'ai vu le même échec pendant vingt ans dans des projets bancaires : des
spécifications « traduites » jusqu'à ce que la règle métier s'en échappe, des
écrans où value date devenait date de valeur alors que le marché dit date de
valorisation. La langue d'un produit n'est pas un habillage ; c'est une partie
de sa logique.

Le design technique découle du choix éditorial. Une page par langue signifie :
aucun état partagé, aucune bascule qui laisse des fragments d'une langue dans
l'autre, un référencement propre avec hreflang, et une négociation de langue qui
n'a lieu qu'à la racine du site. Une URL qui nomme une langue n'est jamais
redirigée : un lien partagé doit rester le lien qui a été partagé.

Le coût est réel : chaque paragraphe existe sept fois, et je le relis sept fois.
C'est le prix d'une promesse simple — 微辣 veut dire 微辣, et quand ce site vous
parle français, il le fait sans accent.
