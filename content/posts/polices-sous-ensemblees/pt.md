---
title: O leitor inglês nunca paga os glifos chineses
date: 2026-02-08
summary: Subconjuntos woff2 e o unicode-range a repartir a factura — e o tofu como sinal de alarme, nunca como defeito de desenho.
tags: [typographie, performance]
---

## A factura que ninguém lia

Vinte anos de software financeiro, em contacto diário com planos de custos,
deixam um reflexo: quando um custo não aparece em nenhuma linha, continua a ser
pago — noutro lado, e sem se saber. As fontes web foram esse custo durante anos.
Declarava-se uma família completa, o navegador descarregava um ficheiro de
vários megabytes, e a isso chamava-se boa tipografia. Ninguém lia a factura; ela
passava no peso da página.

Este sítio funciona de outra maneira. Cada fonte é cortada em subconjuntos
woff2: cada ficheiro guarda apenas os glifos que os textos realmente usam. O
latim cabe numa mão-cheia de kilobytes; o chinês, pela sua natureza, pede mais.
A ordem de grandeza:

| Fonte        |   Escrita coberta   |  Tamanho |
| :----------- | :-----------------: | -------: |
| Noto Sans    |        latim        |  ~ 14 kB |
| Noto Sans SC | chinês simplificado | ~ 130 kB |
| Noto Sans TC | chinês tradicional  | ~ 130 kB |
| Noto Sans HK | chinês de Hong Kong | ~ 135 kB |

## O navegador faz a repartição

A cláusula que torna esta divisão honesta chama-se `unicode-range`, dentro da
declaração `@font-face`. Ela anuncia: este ficheiro serve apenas tal intervalo
de caracteres. O navegador compara os intervalos com o texto da página e
descarrega só o que coincide. Consequência prática: um leitor inglês nunca
descarrega um único byte de chinês. Os ficheiros CJK ficam prontos no servidor,
mas para esse leitor simplesmente não saem de lá: uma página latina nunca toca
esses intervalos.

É, do ponto de vista contabilístico, o modelo que sempre defendi em comité: a
repartição de custos segue o uso real, não o uso imaginável. Não se refactura o
orçamento chinês a um visitante de Londres.

## O tofu é um alarme

O subconjunto tem um modo de falha visível a olho nu. Se um carácter entra nos
textos sem entrar no subconjunto, o navegador não tem nada para desenhar:
recorre ao glifo de substituição, o pequeno rectângulo a que os tipógrafos
chamam tofu — do japonês 豆腐, o bloco de soja coalhada. Um único carácter
esquecido, e o título ganha um quadrado branco.

O tofu, portanto, não é um defeito de desenho: é um sinal. O texto mudou, o
subconjunto não acompanhou. A acção correcta não é um ficheiro maior — seria
voltar à factura opaca — mas uma disciplina: regenerar os subconjuntos a partir
dos caracteres de facto presentes nas fontes sempre que o texto muda, e deixar
um teste confirmá-lo.

## O que levo daqui

De Chengdu, onde vivo, este mecanismo lê-se como um livro-razão bem organizado:
cada visitante paga o que lê, nada mais, e qualquer desvio entre texto e fonte
salta à vista. O `unicode-range` é a chave de repartição; o tofu, o controlo
interno que se recusa a calar.
