---
title: El lector inglés nunca paga los glifos chinos
date: 2026-02-08
summary: Subconjuntos woff2 y unicode-range para repartir la factura — y el tofu como alarma, no como fallo de dibujo.
tags: [typographie, performance]
---

## La factura que nadie leía

Veinte años de software financiero dejan un reflejo: cuando un coste no aparece
en ninguna línea, se paga igualmente — en otra parte y sin saberlo. Las fuentes
web fueron ese coste durante años. Se declaraba una familia completa, el
navegador descargaba un fichero de varios megabytes, y a eso se le llamaba
cuidar la tipografía. Nadie leía la factura; pasaba camuflada en el peso de la
página.

Este sitio funciona de otra manera. Cada fuente se recorta en subconjuntos
woff2: cada fichero conserva solo los glifos que los textos realmente usan. El
latín cabe en un puñado de kilobytes; el chino, por su naturaleza, pide más. El
orden de magnitud:

| Fuente       | Escritura cubierta |   Tamaño |
| :----------- | :----------------: | -------: |
| Noto Sans    |       latín        |  ~ 14 kB |
| Noto Sans SC | chino simplificado | ~ 130 kB |
| Noto Sans TC | chino tradicional  | ~ 130 kB |
| Noto Sans HK | chino de Hong Kong | ~ 135 kB |

## El navegador hace el reparto

La cláusula que hace honesta esta división se llama `unicode-range`, dentro de
la declaración `@font-face`. Viene a decir: este fichero solo sirve tal rango de
caracteres. El navegador compara los rangos con el texto de la página y descarga
únicamente lo que coincide. Consecuencia práctica: un lector inglés jamás
descargará un solo byte de chino. Los ficheros CJK esperan en el servidor,
listos, pero para ese lector sencillamente no salen de él: una página latina
nunca alcanza esos rangos.

Es, contablemente, el modelo que llevo años defendiendo en comités: el reparto
de costes sigue el uso real, no el uso imaginable. No se le repercute el
presupuesto chino a un visitante de Londres.

## El tofu es una alarma

El subconjunto tiene un modo de fallo visible a simple vista. Si un carácter se
cuela en los textos sin colarse en el subconjunto, el navegador no tiene nada
que dibujar: recurre al glifo de sustitución, ese pequeño rectángulo que los
tipógrafos llaman tofu — del japonés 豆腐, el bloque de cuajada de soja. Un solo
carácter olvidado y el titular amanece con un cuadrado blanco.

El tofu, entonces, no es un fallo de dibujo: es una señal. El texto cambió, el
subconjunto no lo siguió. La respuesta no es un fichero más grande — sería
volver a la factura opaca — sino una disciplina: regenerar los subconjuntos a
partir de los caracteres efectivamente presentes en las fuentes cada vez que
cambia el texto, y dejar que una prueba lo confirme.

## Lo que me llevo

Desde Chengdu, donde vivo, este mecanismo se lee como un libro mayor bien
llevado: cada visitante paga lo que lee, nada más, y cualquier desfase entre
texto y fuente salta a la vista. `unicode-range` es la clave de reparto; el
tofu, el control interno que se niega a callar.
