---
title: O Bun como gerador de site estático
date: 2026-01-15
summary: Vinte anos de pipelines de compilação na banca ensinaram-me a desconfiar das dependências. Este sítio é produzido pelo Bun.build, pelo HTMLRewriter e por um pequeno ciclo de pré-renderização — mais nada.
tags: [bun, ssg]
---

Vinte anos no software financeiro deixam hábitos. O meu é contar dependências
antes de contar funcionalidades. Herdei demasiadas cadeias de compilação em que
metade dos pacotes ficara sem responsável e ninguém se lembrava da razão por que
ali estavam. Quando refiz o meu CV em linha, a regra entrou em acção antes da
primeira linha de código: zero dependências de build. Nem Vite, nem Webpack,
nenhum plugin mantido em vida pela boa vontade de um desconhecido.

## Três capacidades, nem mais uma

O Bun torna esta regra exequível. Três das suas capacidades chegam para produzir
o sítio inteiro.

A primeira é o `Bun.build`, o bundler nativo. Um ponto de entrada, um directório
de saída, minificação: com meia dúzia de opções, o TypeScript e o CSS ficam
compilados e os ficheiros ganham a sua impressão digital de cache no nome. Sem
configuração para domar, sem grafo de plugins para depurar numa sexta-feira à
noite.

A segunda é o `HTMLRewriter`, a API de transformação de HTML popularizada pela
Cloudflare Workers e implementada nativamente pelo Bun. É ela que injecta no
cabeçalho do documento as etiquetas de SEO, as ligações `alternate`/`hreflang` e
o guião de negociação de língua — em tempo de compilação, nunca em execução.

A terceira é a mais banal e a mais decisiva: o Bun executa TypeScript
directamente. A minha função de renderização é pura — devolve uma cadeia de
caracteres sem tocar no DOM —, pelo que o build a invoca uma vez por língua e
grava o resultado com `Bun.write`. Sete línguas, oito páginas: o inglês serve de
página raiz e também sai com nome próprio.

O núcleo do pré-render cabe neste ciclo:

```ts
import { renderApp } from "./src/render";
import { LANGS } from "./src/translations";

const result = await Bun.build({
  entrypoints: ["./src/main.ts", "./src/styles.css"],
  outdir: "./dist/assets",
  minify: true,
});
if (!result.success) throw new AggregateError(result.logs, "bundle failed");

for (const lang of LANGS) {
  const html = renderApp(lang); // pure string output, no DOM involved
  const page = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(
          `<link rel="alternate" hreflang="${lang}" href="./${lang}.html">`,
          { html: true },
        );
      },
    })
    .transform(html);
  const name = lang === "en" ? "index.html" : `${lang}.html`;
  await Bun.write(`dist/${name}`, page);
}
```

## O balanço, e os limites

Como product owner, o que me interessa não é a elegância, é o balanço.
Compilação completa em menos de um segundo no meu portátil. Um `dist/`
inteiramente estático, de caminhos relativos, pronto a alojar no GitHub Pages ou
em qualquer outro serviço, sob qualquer caminho de base. Uma CI que só instala o
Bun. E, sobretudo, uma arquitectura que consigo explicar em cinco minutos a um
programador no seu primeiro contacto com o projecto — experimentem fazer isso
com uma configuração de Webpack de 2019.

Sejamos honestos quanto aos limites. O Bun não é o Astro nem o Eleventy: não há
colecções, não há shortcodes, não há ecossistema de temas. Tudo o que ultrapassa
o seu perímetro — sitemap, feeds JSON, metadados sociais — escreve-se à mão. É
exactamente o contracto que assinei: depois de duas décadas a recuperar sistemas
que já ninguém compreendia por inteiro, prefiro uma ferramenta que faça pouco,
mas que eu compreenda por completo.

De Chengdu, onde vivo, a metáfora impõe-se: é a diferença entre uma cozinha
cheia de robôs e uma boa faca. A faca não faz tudo. Mas nunca avaria numa
sexta-feira à noite.
