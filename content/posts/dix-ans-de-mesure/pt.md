---
title: Dez anos a medir texto no navegador
date: 2026-07-30
summary: De getBoundingClientRect às medições fora do DOM — o que uma década de tipografia na web mudou na minha prática, e o que nunca se moveu um pixel.
tags: [typographie, rétrospective]
---

Há dez anos, medi texto num navegador pela primeira vez na minha carreira. A
exigência cabia numa frase: fazer caber o nome de um operador de mercado no
cabeçalho de um ecrã de posições, sem nunca o truncar. A resposta de 2016 cabia
numa linha — uma chamada a `getBoundingClientRect` — que me custou, ao longo dos
anos, mais dias de caça a erros do que qualquer fórmula de avaliação que tenha
entregue. Esta retrospectiva vai dessa linha às medições fora do DOM que pratico
hoje, para separar o que dez anos mudaram do que nunca se moveu um pixel.

## A régua vivia no documento

Nessa altura, medir texto era um ritual. Criava-se um `span` invisível,
estacionado fora do ecrã, injectava-se a cadeia de caracteres, lia-se a largura
e retirava-se o elemento antes que alguém desse por ele. Ninguém questionava o
gesto: era o preço de uma informação que o navegador guardava para si.

Descobri o custo real num analisador de desempenho. O `getBoundingClientRect`
tem de responder com exactidão no momento da chamada, mas o motor de
renderização trabalha em diferido: as escritas acumulam-se numa fila. Para
responder, o navegador esvazia a fila na hora: estilos recalculados, paginação
executada em síncrono, enquanto o JavaScript espera. Uma leitura após cada
escrita, num ciclo de trinta entradas de menu, e o fotograma vai-se em
recálculos invisíveis. Gestor de produto de profissão — um analista de negócio
que escreve o seu próprio código —, desconfio das linhas inocentes há vinte anos
de software financeiro: é aí que os custos dormem.

O pior era funcional: o nome truncado em alemão, porque uma largura medida em
inglês nada diz sobre «Geschäftsführer». Os nossos relatórios de erros
tipográficos liam-se como um atlas.

## O interlúdio do canvas

Por volta de 2018 julgámos ter encontrado a saída: o `measureText`, num contexto
de canvas. Sem DOM, sem refluxo, uma resposta em microssegundos. Ganhámos
velocidade e perdemos precisão. O método devolve avanços, não uma composição:
sem hifenização nem quebras de linha, um kerning variável consoante os motores,
e uma dependência silenciosa da ordem de carregamento das fontes. Medido cedo
demais, o texto era medido numa fonte de recurso — e ninguém dava por isso até à
demonstração.

Guardei desse episódio uma lição que ultrapassa a tipografia: uma medição rápida
mas errada é pior do que uma lenta, porque inspira confiança. Na banca, diríamos
que passa nos controlos.

## A medição sai do documento

A verdadeira viragem chegou mais tarde, quando medir deixou de ser uma pergunta
feita ao documento e passou a ser uma operação pura: uma cadeia, uma fonte, um
corpo, uma tabela de métricas. Prepara-se a cadeia uma vez, obtêm-se as larguras
por aritmética, guarda-se o resultado em cache. O documento só entra na história
para exibir uma resposta já conhecida.

Duas consequências mudaram a minha prática. A página nasce com o tamanho
correcto, em vez de se corrigir à frente do leitor. E a medição torna-se
testável fora do navegador, numa bateria de testes vulgar — a minha corre em Bun
durante a compilação.

As restrições mudaram de natureza: é precisa a fonte real, logo é preciso
esperar pelo `document.fonts.ready`; a quebra de linhas passa a ser da nossa
responsabilidade. Mas são restrições de dados, e os dados testam-se. É o
contracto que eu esperava há vinte anos.

## O que nunca mudou

Dez anos, e a substância nunca se moveu. Medir continua a ser um acto
tipográfico, não uma proeza técnica. O alemão continua a transbordar, o chinês
continua a ignorar os espaços, e uma quebra mal colocada continua a ser uma
falha de gosto nas sete línguas deste sítio. Em Chengdu, o texto latino e o
chinês cruzam-se todos os dias diante de mim: já não preciso de um relatório de
erro para saber que as regras de quebra são diferentes — leio-as nos menus dos
restaurantes.

Mais uma constante: a medição é um contracto com o leitor. Um nome truncado num
relatório bancário não é um defeito cosmético, é uma quebra de confiança — como
um montante arredondado sem aviso. É por isso que continuo a verificar estes
números com as próprias mãos, com o mesmo reflexo da reconciliação
contabilística: um número produzido em síncrono pelo motor de paginação é um
número cujo custo se esconde noutra linha das contas.

## O que guardo

As ferramentas mudaram duas vezes em dez anos; a disciplina, nunca. Medir com a
fonte real. Nunca confiar num número cujo custo não se viu. Pagar uma vez, na
preparação, e manter a leitura gratuita. Este sítio mede o título e a navegação
com o [pretext](https://github.com/chenglou/pretext), que prepara uma vez e
depois só faz aritmética: dez anos depois daquele primeiro
`getBoundingClientRect`, a régua já não vive no documento. Vive nos dados, onde
eu a devia ter procurado em 2016.
