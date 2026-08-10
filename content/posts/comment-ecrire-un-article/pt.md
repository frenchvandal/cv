---
title: Como escrever um artigo
date: 2026-08-09
summary: Porque é que os artigos deste sítio vivem em Markdown no disco, como a construção os renderiza sem dependência acrescentada, e o modo de emprego para escrever um.
tags: [meta, web]
---

## Porquê Markdown no disco

O CV vive em `src/translations.ts`, ao lado dos textos da interface: um
documento traduzido à mão em sete línguas, cada cadeia medida e ajustada pelo
código. Um artigo é o contrário — prosa longa, nem tipada nem medida, e virão
outros. Não quero que o pacote engorde a cada publicação, nem que uma gralha
faça falhar a compilação. O conteúdo vive portanto no disco, lido pela
construção na pré-renderização. O código continua código, a prosa continua
prosa.

## O sistema de ficheiros é o dado

O endereço de um artigo tem dois segmentos: a pasta é o slug, o ficheiro é a
língua. `content/posts/comment-ecrire-un-article/pt.md` é a página que está a
ler; `en.md` ao lado é a versão inglesa. Nem tabela de correspondência nem
registo: traduzir é depositar um ficheiro junto dos outros; retirar uma língua é
apagar um ficheiro. A regra — um artigo existe em uma a n línguas, cada índice
lista apenas o que existe na sua — não pode ser violada por esquecimento.
`shanghai-note` é a demonstração: existe em chinês e mais nada, de modo que um
leitor espanhol nunca o vê no seu índice, e a partir da página chinesa o
selector leva ao índice de cada uma das outras línguas em vez de a uma ligação
morta. Este artigo, esse, existe nas sete.

## Renderizar sem dependência

A renderização é a do `Bun.markdown`, o motor GFM nativo: o blogue não
acrescenta nenhuma dependência de renderização a um projecto que tem duas ao
todo. Dois tempos — `Bun.markdown.html()` produz o HTML, depois o
`HTMLRewriter` acrescenta o que ele não faz: âncoras de títulos, `rel` nas
ligações externas, tabelas deslizáveis, imagens preguiçosas, marcação `lang` das
passagens chinesas.

## O inglês na raiz

O inglês vive na raiz, cada uma das outras línguas na sua pasta: `/blog/…` em
inglês, `/pt/blog/…` para esta versão. Os caminhos dos recursos, calculados a
partir da profundidade de cada página, mantêm-se relativos: `dist/` deposita-se
tal e qual atrás de qualquer prefixo, sem reconstruir nada. Só os URL absolutos
da indexação recebem o domínio, no momento da entrega.

## A protecção, nem mais nem menos

O `Bun.markdown` deixa passar HTML em bruto. Bloquear etiquetas conhecidas uma a
uma seria uma lista negra, aberta por construção; a construção aplica portanto
uma lista branca fechada: só passam as etiquetas que Markdown legítimo produz,
tudo o resto é recusado, conhecido ou não. Nenhum atributo `on…` passa. Todo
`href` ou `src` tem de ser `http`, `https`, `mailto` ou relativo, depois de
descodificadas as entidades e retirados os caracteres de controlo que
disfarçariam um `javascript:`; uma entidade não resolvida é recusada, porque o
navegador havia de a descodificar.

O que isto não garante: os atributos que não são nem manipuladores nem URL
passam sem exame. Não é um sanitizador geral, mas uma vedação à volta do que um
artigo pode produzir — e este artigo passa o seu próprio filtro, que é o
princípio.

## O manual

Escrever um artigo é criar um ficheiro:

```text
content/posts/<slug>/<lang>.md
```

O slug junta minúsculas, algarismos e hífenes. Alguns nomes estão reservados
porque já designam um ficheiro ou uma pasta do sítio: `assets`, `blog`, `cv`,
`index`, `404`, `robots`, `sitemap`, `feed`, `og-image`, e os códigos de língua
— um artigo chamado `pt` escreveria por cima da pasta da língua.

O frontmatter é YAML, e é o `Bun.YAML.parse` que o lê — a gramática é a do Bun,
escreve-se portanto o que já se escreve em todo o lado. O que a construção tem a
seu cargo é o contrato: `title` e `date` obrigatórios, o resto opcional,
qualquer chave desconhecida ou duplicada recusada nomeando o ficheiro. Um
exemplo completo:

```text
---
title: Como escrever um artigo
date: 2026-08-09
summary: O que o artigo anuncia, numa frase.
tags: [meta, web]
---
```

Campo a campo: `date` é uma data `YYYY-MM-DD` verdadeira — 31 de Fevereiro é
recusado; `summary`, ausente, é deduzido do texto; `tags` toma a forma `[a, b]`;
`draft: true` exclui o artigo excepto se `DRAFTS=1`; `updated` data uma revisão.

Para ler o artigo no seu URL verdadeiro — o servidor de desenvolvimento não
conhece os do blogue:

```bash
bun run preview           # constrói, depois serve em http://localhost:4173
PORT=8080 bun run preview # outra porta
DRAFTS=1 bun run preview  # rascunhos incluídos
```

Depois de escrever, mais um comando:

```bash
bun run fonts:update
```

Volta a subdividir as fontes Noto do sítio: um glifo ausente do subconjunto
aparece em tofu — uma falha que só se descobre no ecrã do leitor.

Por fim, a regra `zh-hk`: escrever `zh-hant.md` chega — a versão de Hong Kong é
projectada a partir da de Taiwan pelo léxico do sítio, e um `zh-hk.md` explícito
prevalece. As convenções secas vivem no `AGENTS.md`; este artigo é a narrativa,
aquele ficheiro é a referência.
