---
title: Cómo escribir un artículo
date: 2026-08-09
summary: Por qué los artículos de este sitio viven como archivos Markdown en el disco, cómo la compilación los renderiza sin añadir ninguna dependencia, y el manual completo para escribir uno.
tags: [meta, web]
---

## Por qué Markdown en el disco

El CV vive en `src/translations.ts`, junto a los textos de la interfaz: un
documento traducido a mano a siete idiomas, con cada cadena medida y ajustada
por el código. Un artículo es lo contrario — prosa larga, ni tipada ni medida, y
vendrán más. No quiero que el paquete engorde con cada publicación, ni que una
errata rompa la compilación. El contenido vive por tanto en el disco, y la
compilación lo lee al prerenderizar. El código sigue siendo código; la prosa,
prosa.

## El sistema de archivos es el dato

La dirección de un artículo tiene dos segmentos: la carpeta es el slug, el
archivo es el idioma. `content/posts/comment-ecrire-un-article/es.md` es la
página que está leyendo; `en.md` al lado es la versión inglesa. Ni tabla de
correspondencias ni registro: traducir es dejar un archivo junto a los demás;
retirar un idioma es borrar uno. La regla — un artículo existe en uno a n
idiomas, y cada índice lista solo lo que existe en el suyo — no puede violarse
por olvido. `shanghai-note` es la demostración: existe en chino y en nada más,
de modo que un lector español no lo ve nunca en su índice, y desde la página
china el selector lleva al índice de cada uno de los otros idiomas en lugar de a
un enlace muerto. Este artículo, en cambio, existe en los siete.

## Renderizar sin dependencias

El renderizado es el de `Bun.markdown`, el motor GFM nativo: el blog no añade
ninguna dependencia de renderizado a un proyecto que solo tiene dos en total.
Dos pasadas — `Bun.markdown.html()` produce el HTML, y después `HTMLRewriter`
aplica lo que aquél no hace: anclas de títulos, `rel` en los enlaces externos,
tablas desplazables, imágenes perezosas y el marcado `lang` de los pasajes
chinos.

## El inglés en la raíz

El inglés vive en la raíz y cada uno de los demás idiomas en su carpeta:
`/blog/…` en inglés, `/es/blog/…` para esta versión. Las rutas de los recursos,
calculadas a partir de la profundidad de cada página, siguen siendo relativas:
`dist/` se deposita tal cual detrás de cualquier prefijo, sin reconstruir nada.
Solo las URL absolutas del posicionamiento reciben el dominio, en el despliegue.

## La barrera, ni más ni menos

`Bun.markdown` deja pasar HTML en bruto. Bloquear etiquetas conocidas una a una
sería una lista negra, abierta por construcción; la compilación aplica por tanto
una lista blanca cerrada: solo pasan las etiquetas que produce el Markdown
legítimo, y todo lo demás se rechaza, conocido o no. Ningún atributo `on…` pasa.
Todo `href` o `src` ha de ser `http`, `https`, `mailto` o relativo, una vez
descodificadas las entidades y retirados los caracteres de control que
disfrazarían un `javascript:`; una entidad sin resolver se rechaza, porque el
navegador sí la descodificaría.

Lo que no garantiza: los atributos que no son ni manejadores ni URL pasan sin
examen. No es un saneador general, sino un cercado alrededor de lo que un
artículo puede producir — y este artículo pasa su propio filtro, que es de lo
que se trata.

## El manual

Escribir un artículo es crear un archivo:

```text
content/posts/<slug>/<lang>.md
```

El slug reúne minúsculas, cifras y guiones. Algunos nombres están reservados
porque ya designan un archivo o una carpeta del sitio: `assets`, `blog`, `cv`,
`index`, `404`, `robots`, `sitemap`, `feed`, `og-image`, y los códigos de idioma
— un artículo llamado `es` sobrescribiría la carpeta del idioma.

El frontmatter es YAML, y quien lo lee es `Bun.YAML.parse` — la gramática es la
de Bun, así que se escribe lo que ya se escribe en todas partes. De lo que se
ocupa la compilación es del contrato: `title` y `date` obligatorios, el resto
opcional, y cualquier clave desconocida o duplicada rechazada nombrando el
archivo. Un ejemplo completo:

```text
---
title: Cómo escribir un artículo
date: 2026-08-09
summary: Lo que el artículo anuncia, en una frase.
tags: [meta, web]
---
```

Campo por campo: `date` es una fecha `YYYY-MM-DD` de verdad — el 31 de febrero
se rechaza; `summary`, si falta, se deduce del texto; `tags` toma la forma
`[a, b]`; `draft: true` excluye el artículo salvo con `DRAFTS=1`; `updated`
fecha una revisión.

Para leer el artículo en su URL verdadera — el servidor de desarrollo no conoce
las del blog:

```bash
bun run preview           # compila y sirve en http://localhost:4173
PORT=8080 bun run preview # otro puerto
DRAFTS=1 bun run preview  # borradores incluidos
```

De las fuentes no hace falta ocuparse: al empujar a `main`, un flujo de trabajo
vuelve a subdividir las Noto del sitio y confirma los archivos. Si se quiere ver
el artículo con su tipografía real antes de empujar:

```bash
bun run fonts:update
```

Un glifo ausente del subconjunto aparece como tofu, y la compilación se niega a
emitir un `dist/` que no lo cubra: el olvido es un fallo ruidoso, nunca una
sorpresa en la pantalla del lector.

Por último, la regla `zh-hk`: basta con escribir `zh-hant.md` — la versión de
Hong Kong se proyecta desde la de Taiwán mediante el léxico del sitio, y un
`zh-hk.md` explícito prevalece. Las convenciones secas viven en `AGENTS.md`;
este artículo es el relato, y aquel archivo la referencia.
