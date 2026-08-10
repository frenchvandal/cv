---
title: Knuth–Plass na prática, ou o que o navegador não entende de justificação
date: 2025-11-21
summary: Vinte anos de software financeiro ensinaram-me a desconfiar das aproximações. O que o algoritmo de Knuth–Plass muda na justificação de um parágrafo, e por que razão a contracção tem de ser zero quando o CSS só sabe esticar espaços.
tags: [typographie, algorithmes]
---

Passo os dias a ler documentos longos — exigências regulamentares, relatórios de
auditoria, especificações funcionais. É o ofício: vinte anos como gestor de
produto e analista de negócio no software financeiro, os últimos passados em
Chengdu, em contacto permanente com equipas de três continentes, ensinaram-me
que a maior parte dos problemas de qualidade são problemas de optimização mal
enquadrados. A justificação de um parágrafo no navegador é um exemplo pequeno e
perfeito.

O que o navegador faz com `text-align: justify` é guloso: enche uma linha de
cada vez, pela ordem, e pára na primeira palavra que já não cabe. Depois estica
os espaços dessa linha até à margem direita. Cada linha é localmente aceitável,
e o conjunto é uma desgraça — uma linha cheia de buracos brancos por cima de
outra comprimida, e o olho do leitor tropeça a cada regresso.

Knuth e Plass publicaram a alternativa em 1981, para o TeX: tratar o parágrafo
como um todo. O texto passa a ser uma sequência de caixas (as palavras), cola
(os espaços, que podem esticar ou contrair dentro de limites declarados) e
penalizações (os pontos de hifenização). O algoritmo examina todas as sequências
de corte viáveis e escolhe a que minimiza os deméritos acumulados do parágrafo
inteiro. Um corte medíocre para a sua linha pode ser o correcto se desbloquear
as três seguintes. O guloso optimiza o trimestre; o óptimo optimiza o plano a
cinco anos.

A hifenização é o que dá espaço de manobra ao optimizador. Cada ponto de corte
silábico — os padrões de Liang, no meu caso — é mais uma posição candidata, o
que significa menos espaços esticados à força. Sem hifenização, a quebra óptima
continua a ganhar à gulosa em texto latino, mas as colunas estreitas deixam-na
sem opções.

O pormenor que mais me custou a interiorizar é o `shrink: 0`. No modelo do TeX,
a cola pode comprimir-se, porque o TeX de facto renderiza espaços comprimidos. O
CSS não: o navegador alarga os espaços, nunca os estreita. Se o solucionador
usar contracção, devolve soluções que o motor de renderização não consegue
cumprir — linhas que deviam caber acabam a transbordar. Fixa-se portanto a
contracção em zero, e o optimizador só propõe o que o CSS consegue entregar. Uma
restrição de implementação subida ao modelo, que é onde as restrições deviam
estar sempre. Depois de vinte anos a escrever especificações, quem me dera ver
este reflexo mais vezes.

O exercício que me convenceu: parágrafos longos de prosa contínua, quase sem
marcação — o caso mais ingrato, e o mais frequente nos projectos por onde
passei. À mesma largura de coluna, a versão gulosa mostra buracos visíveis; a
óptima simplesmente se lê. É tudo o que se pode pedir a uma infra-estrutura: que
desapareça.
