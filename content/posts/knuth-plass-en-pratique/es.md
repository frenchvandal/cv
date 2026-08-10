---
title: Knuth–Plass en la práctica, o lo que el navegador no entiende de justificación
date: 2025-11-21
summary: Veinte años de software financiero me enseñaron a desconfiar de las aproximaciones. Qué cambia el algoritmo de Knuth–Plass en la justificación de un párrafo, y por qué la contracción debe ser cero cuando CSS solo sabe estirar espacios.
tags: [typographie, algorithmes]
---

Me paso el día leyendo documentos largos: requisitos regulatorios, informes de
auditoría, especificaciones funcionales. Es el oficio: veinte años como gestor
de producto y analista de negocio en el software financiero, los últimos
instalado en Chengdu, me han enseñado que casi todos los problemas de calidad
son problemas de optimización mal planteados. La justificación de un párrafo en
el navegador es un ejemplo pequeño y perfecto.

Lo que hace el navegador con `text-align: justify` es voraz: rellena una línea
cada vez, en orden, y se detiene en la primera palabra que ya no cabe. Después
estira los espacios de esa línea hasta el margen derecho. Cada línea es
localmente aceptable, y el conjunto es un desastre: una línea llena de huecos
blancos encima de otra apretada, y el ojo del lector tropieza en cada retorno.

Knuth y Plass publicaron la alternativa en 1981, para TeX: tratar el párrafo
como un todo. El texto se convierte en una secuencia de cajas (las palabras),
pegamento (los espacios, que pueden estirarse o contraerse dentro de unos
límites declarados) y penalizaciones (los puntos de división silábica). El
algoritmo examina todas las secuencias de corte viables y elige la que minimiza
los deméritos acumulados del párrafo entero. Un corte mediocre para su línea
puede ser el correcto si desbloquea las tres siguientes. El voraz optimiza el
trimestre; el óptimo optimiza el plan quinquenal.

La división silábica es lo que da margen de maniobra al optimizador. Cada punto
de corte — los patrones de Liang, en mi caso — es una posición candidata más, lo
que significa menos espacios estirados a la fuerza. Sin ella, la ruptura óptima
sigue ganando a la voraz en texto latino, pero las columnas estrechas la dejan
sin opciones.

El detalle que más me costó interiorizar es `shrink: 0`. En el modelo de TeX, el
pegamento puede comprimirse, porque TeX de verdad renderiza espacios
comprimidos. CSS no: el navegador ensancha los espacios, nunca los estrecha. Si
el solucionador usa contracción, devuelve soluciones que el motor de renderizado
no puede cumplir — líneas que debían caber acaban saliéndose. Así que se fija la
contracción a cero, y el optimizador solo propone lo que CSS puede entregar. Una
restricción de implementación subida al modelo, que es donde las restricciones
deberían estar siempre. Después de veinte años escribiendo especificaciones,
ojalá viera este reflejo más a menudo.

El ejercicio que me convenció: párrafos largos de prosa continua, casi sin
marcado — el caso más ingrato, y el más frecuente en mis documentos. A igual
anchura de columna, la versión voraz muestra huecos visibles; la óptima
simplemente se lee. Eso es todo lo que se le puede pedir a una infraestructura:
que desaparezca.
