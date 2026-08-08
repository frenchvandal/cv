---
title: Medir el texto sin pagar el reflow
date: 2025-09-12
summary: Por qué getBoundingClientRect fuerza una maquetación síncrona y qué cambia al medir el texto fuera del DOM.
tags: [typographie, bun]
---

## El síntoma

El analizador de rendimiento no mentía: en la página que acababa de entregar,
Chrome atribuía casi un tercio del tiempo de cada fotograma a una línea de
aspecto inocente, una llamada a `getBoundingClientRect`. Soy product owner de
oficio — un analista de negocio que escribe su propio código y, por tanto, puede
comprobar sus propias sospechas — y veinte años de software financiero me
enseñaron a desconfiar de las líneas inocentes: ahí es donde duermen los costes.

El mecanismo está documentado, y aun así se olvida. Ese método tiene que
devolver una geometría exacta en el instante de la llamada, mientras el motor de
renderizado trabaja en diferido: las escrituras de estilos y de DOM se acumulan
en una cola. Para contestar con exactitud, el navegador tiene que vaciar esa
cola en el acto — recalcular estilos, luego la maquetación, todo en síncrono,
con el JavaScript esperando. Una lectura después de cada escritura, en un bucle
sobre treinta entradas de menú, y tenemos lo que la literatura llama _layout
thrashing_: el fotograma entero gastado en recálculos que ningún usuario verá en
pantalla.

Así que el coste no está en la llamada, que tarda microsegundos. Está en lo que
provoca: una maquetación completa, en un momento que no elegiste.

## Medir sin tocar el DOM

Existe otra vía, y cambia más que el rendimiento. Medir un texto es, en el
fondo, una operación pura: una cadena, una tipografía, un cuerpo, y una tabla de
métricas. Nada de eso exige un elemento. Preparas la cadena una vez, obtienes su
anchura por aritmética, guardas el resultado en caché — y puedes probarlo todo
fuera del navegador, en una batería de pruebas unitarias cualquiera.

Las consecuencias son prácticas:

1. Se acabó la invalidación: la medición no toca el documento, luego no puede
   ensuciarlo.
2. El resultado se conoce antes del primer pintado: la página nace con el tamaño
   correcto, en vez de corregirse delante del lector.
3. El coste se vuelve legible: se paga una vez, en la preparación, no en cada
   lectura.

El precio honesto: hay que medir con la tipografía real, lo que implica esperar
a que cargue, y el corte de líneas pasa a ser cosa tuya. Restricciones reales,
sí — pero de datos, y los datos se pueden probar.

## Qué me llevo

Este sitio, escrito desde Chengdu, donde vivo desde hace años, ajusta su titular
y su navegación con [pretext](https://github.com/chenglou/pretext), que prepara
una vez y luego solo hace aritmética. Reconozco en ello el reflejo de la
conciliación contable de mi trabajo diario: un número producido en síncrono por
el motor de maquetación es un número cuyo coste está escondido en otra partida
del libro mayor. Medido fuera del DOM, el mismo número vuelve a ser un dato:
reproducible, comprobable, pagado una sola vez.
