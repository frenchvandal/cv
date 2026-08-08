---
title: Medir o texto sem pagar o reflow
date: 2025-09-12
summary: Porque é que getBoundingClientRect força uma paginação síncrona, e o que muda quando se mede o texto fora do DOM.
tags: [typographie, bun]
---

## O sintoma

O analisador de desempenho não mentia: na página que eu acabara de entregar, o
Chrome atribuía quase um terço do tempo de cada fotograma a uma linha de aspecto
inocente — uma chamada a `getBoundingClientRect`. Sou product owner de
profissão, um analista de negócio que escreve o próprio código e pode, por isso,
confirmar as próprias suspeitas; e vinte anos de software financeiro
ensinaram-me a desconfiar das linhas inocentes: é aí que os custos dormem.

O mecanismo está documentado, e mesmo assim esquece-se. Esse método tem de
devolver uma geometria exacta no instante da chamada, enquanto o motor de
renderização trabalha de forma diferida: as escritas de estilos e de DOM
acumulam-se numa fila. Para responder com justeza, o navegador é obrigado a
esvaziar a fila na hora — recalcular estilos, depois a paginação, tudo em
síncrono, com o JavaScript à espera. Uma leitura depois de cada escrita, num
ciclo sobre trinta entradas de menu, e temos aquilo a que os ingleses chamam
_layout thrashing_: o fotograma inteiro gasto em recálculos que nenhum
utilizador verá no ecrã.

O custo não está, portanto, na chamada, que leva microssegundos. Está no que ela
força: uma paginação completa, num momento que não escolhemos.

## Medir sem tocar no DOM

Existe outra via, e ela muda mais do que o desempenho. Medir um texto é, no
fundo, uma acção pura: uma cadeia de caracteres, um tipo de letra, um corpo, e
uma tabela de métricas. Nada disto exige um elemento. Prepara-se a cadeia uma
única vez, obtém-se a largura por aritmética, guarda-se o resultado — e pode
testar-se tudo fora do navegador, numa série de testes unitários banal.

As consequências são concretas. Primeiro, acabou a invalidação: a medição não
tem contacto com o documento, logo não o pode sujar. Depois, o resultado
conhece-se antes da primeira pintura: a página nasce com o tamanho certo, em vez
de se corrigir diante do leitor. Por fim, o custo torna-se legível: pago uma
vez, na preparação, e não a cada leitura.

O preço honesto: é preciso medir com o tipo de letra real, o que implica esperar
pelo carregamento, e a quebra de linhas passa a ser da nossa responsabilidade.
São restrições reais — mas de dados, e os dados testam-se.

## O que levo daqui

Este sítio, escrito a partir de Chengdu, onde estou instalado há anos, ajusta o
título principal e a navegação com o
[pretext](https://github.com/chenglou/pretext), que prepara uma vez e depois só
faz aritmética. Reconheço aqui o reflexo da reconciliação contabilística do meu
dia de trabalho: um número produzido em síncrono pelo motor de paginação é um
número cujo custo está escondido noutra conta do razão. Medido fora do DOM, o
mesmo número volta a ser um dado — reprodutível, testável, pago uma única vez.
