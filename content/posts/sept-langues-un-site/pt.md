---
title: Sete línguas, um só sítio
date: 2025-10-03
summary: "Uma página por língua, escrita para o seu público, nunca tradução automática: vinte anos de software financeiro e um 微辣 em Chengdu."
tags: [multilinguisme, web]
---

Depois de vinte anos no software financeiro — primeiro como analista de negócio,
depois como gestor de produto — aprendi a desconfiar dos requisitos que cabem
numa frase. « O sítio tem de ser multilingue » é um deles. À primeira vista, uma
caixa de verificação. Na realidade, uma decisão de arquitectura, uma posição
editorial e uma promessa feita ao leitor.

## Uma página por língua

Este sítio fala sete línguas: inglês, francês, português, espanhol e três
variantes de chinês — 简体字 para o continente, 繁體字 para Taiwan, mais uma
projecção para Hong Kong. Cada língua é uma página estática completa, gerada
antecipadamente. Não há máquina de tradução entre nós: nem API de tradução no
carregamento, nem JavaScript que reescreva a página enquanto a lê. Quando lê a
versão portuguesa, cada frase foi escrita para si — não convertida a partir do
inglês.

Porquê esta exigência? Porque vivo em Chengdu, e o chinês deu-me a melhor
metáfora da minha carreira. Num restaurante daqui peço 微辣 — « pouco picante ».
O dicionário concorda: mildly spicy. Literal, correcto e inútil. O 微辣 local é
uma escala própria, uma convenção entre o cozinheiro e o cliente. A tradução
automática entrega as palavras e perde a convenção, todas as vezes. Escrever é
uma acção sobre leitores; traduzir automaticamente é uma acção sobre palavras.

## A língua faz parte da lógica

Vi o mesmo falhanço durante duas décadas em projectos bancários: especificações
« traduzidas » até a regra de negócio se perder, ecrãs onde value date virava
date de valeur quando o mercado diz date de valorisation. A língua de um produto
não é decoração; é parte da sua lógica.

O desenho técnico segue a escolha editorial. Uma página por língua significa:
nenhum estado partilhado, nenhuma mudança que deixe fragmentos de uma língua
dentro da outra, referenciação limpa com hreflang e negociação de língua apenas
na raiz do sítio. Um endereço que nomeia uma língua nunca é redireccionado: uma
ligação partilhada tem de continuar a ser a ligação que foi partilhada.

O custo é real: cada parágrafo existe sete vezes, e eu releio-o sete vezes. É o
preço de uma promessa simples — 微辣 significa 微辣, e quando este sítio lhe
fala em português, fá-lo sem sotaque. E se alguma frase soar a falso, o contacto
está na página inicial: as sete versões passam todas pelos meus olhos.
