---
title: Bun como generador de sitios estáticos
date: 2026-01-15
summary: Veinte años de pipelines de compilación en la banca me enseñaron a desconfiar de las dependencias. Este sitio lo producen Bun.build, HTMLRewriter y un pequeño bucle de prerenderizado, y nada más.
tags: [bun, ssg]
---

Veinte años en el software financiero dejan costumbres. La mía es contar
dependencias antes de contar funciones. He heredado demasiadas cadenas de
compilación en las que la mitad de los paquetes se había quedado sin mantenedor
y nadie recordaba por qué estaban ahí. Cuando rehice mi CV en línea, la regla
quedó fijada antes de la primera línea de código: cero dependencias de build. Ni
Vite, ni webpack, ni un solo plugin mantenido con vida por la buena voluntad de
un desconocido.

## Tres capacidades, ni una más

Bun hace que esa regla sea asumible. Tres de sus capacidades bastan para
producir el sitio entero.

La primera es `Bun.build`, el empaquetador nativo. Un punto de entrada, un
directorio de salida, minificación: con un puñado de opciones, TypeScript y CSS
quedan compilados y los nombres de fichero llevan su huella de caché. Sin
configuración que domar, sin grafo de plugins que depurar un viernes por la
noche.

La segunda es `HTMLRewriter`, la API de transformación de HTML popularizada por
Cloudflare Workers e implementada de forma nativa por Bun. Es la que inyecta en
la cabecera del documento las etiquetas SEO, los enlaces `alternate`/`hreflang`
y el script de negociación de idioma: en tiempo de compilación, nunca en
ejecución.

La tercera es la más trivial y la más decisiva: Bun ejecuta TypeScript
directamente. Mi función de renderizado es pura — devuelve una cadena sin tocar
el DOM —, de modo que el build la invoca una vez por idioma y escribe el
resultado con `Bun.write`. Siete idiomas, ocho páginas: el inglés hace de página
raíz y además se publica con su propio nombre.

El corazón del prerenderizado cabe en este bucle:

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

## El balance, y los límites

Como product owner, lo que me importa no es la elegancia sino el balance.
Compilación completa en menos de un segundo en mi ordenador portátil. Un `dist/`
enteramente estático, con rutas relativas, desplegable tal cual en GitHub Pages
o en cualquier alojamiento, bajo cualquier ruta base. Una CI que no instala nada
más que Bun. Y sobre todo una cadena que puedo explicar en cinco minutos a un
desarrollador que aterrice en el proyecto: probad a hacerlo con una
configuración de webpack de 2019.

Seamos honestos con los límites. Bun no es Astro ni Eleventy: no hay
colecciones, ni shortcodes, ni ecosistema de temas. Todo lo que excede su
perímetro — sitemap, feeds JSON, metadatos sociales — se escribe a mano. Y ese
es exactamente el contrato que firmé: después de dos décadas rescatando sistemas
que ya nadie entendía por completo, prefiero una herramienta que haga poco y que
yo entienda del todo.

Desde Chengdu, donde vivo, la metáfora se impone: es la diferencia entre una
cocina llena de robots y un buen cuchillo. El cuchillo no lo hace todo. Pero
nunca se estropea un viernes por la noche.
