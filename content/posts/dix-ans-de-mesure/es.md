---
title: Diez años midiendo texto en el navegador
date: 2026-07-30
summary: De getBoundingClientRect a las mediciones fuera del DOM — lo que una década de tipografía web cambió en mi práctica, y lo que no se movió ni un píxel.
tags: [typographie, rétrospective]
---

Hace diez años medí texto en un navegador por primera vez en mi carrera. El
requisito cabía en una frase: mantener el nombre de un operador dentro de la
cabecera de una pantalla de posiciones, sin truncarlo jamás. La respuesta de
2016 cabía en una línea — una llamada a `getBoundingClientRect` — que me costó,
con los años, más días de caza de errores que cualquier fórmula de valoración
que haya entregado. Esta retrospectiva va de esa línea a las mediciones fuera
del DOM de hoy, para separar lo que diez años cambiaron de lo que no se movió ni
un píxel.

## La regla vivía en el documento

En aquella época, medir texto era un ritual. Se creaba un `span` invisible,
aparcado fuera de la pantalla, se inyectaba la cadena, se leía su anchura y se
retiraba el elemento antes de que nadie se diera cuenta. Nadie cuestionaba el
gesto: era el precio de una información que el navegador guardaba para sí.

Descubrí el coste real en un perfilador. `getBoundingClientRect` debe responder
con exactitud en el momento de la llamada, pero el motor de renderizado trabaja
en diferido: las escrituras se acumulan en una cola. Para responder, el
navegador vacía la cola en el acto: estilos recalculados, maquetación ejecutada
de forma síncrona, mientras tu JavaScript espera. Una lectura tras cada
escritura, en un bucle de treinta entradas de menú, y el fotograma se va en
recálculos invisibles. Gestor de producto de oficio — un analista de negocio que
escribe su propio código —, desconfío de las líneas inocentes desde hace veinte
años de software financiero: ahí duermen los costes.

Lo peor era funcional: el nombre truncado en alemán, porque una anchura medida
en inglés no dice nada de «Geschäftsführer». Nuestros informes de errores
tipográficos se leían como un atlas.

## El interludio del canvas

Hacia 2018 creímos haber encontrado la salida: `measureText`, sobre un contexto
de canvas. Sin DOM, sin reflujo, una respuesta en microsegundos. Ganamos
velocidad y perdimos precisión. El método devuelve avances, no una composición:
sin guionado ni saltos de línea, un kerning variable según los motores, y una
dependencia silenciosa del orden de carga de las fuentes. Medido demasiado
pronto, el texto se medía con una fuente de reserva — y nadie se daba cuenta
hasta la demostración.

Me quedé con una lección que va más allá de la tipografía: una medición rápida
pero errónea es peor que una lenta, porque inspira confianza. En la banca
diríamos que supera los controles.

## La medición sale del documento

El verdadero giro llegó más tarde, cuando medir dejó de ser una pregunta hecha
al documento y se convirtió en una operación pura: una cadena, una fuente, un
cuerpo, una tabla de métricas. Se prepara la cadena una vez, se obtienen las
anchuras por aritmética, se guarda el resultado en caché. El documento solo
entra en la historia para mostrar una respuesta ya conocida.

Dos consecuencias cambiaron mi práctica. La página nace con el tamaño correcto
en lugar de corregirse delante del lector. Y la medición se vuelve comprobable
fuera del navegador, en una batería de pruebas cualquiera — la mía corre bajo
Bun durante la compilación.

Las restricciones cambiaron de naturaleza: hace falta la fuente real, así que
toca esperar a `document.fonts.ready`; el corte de líneas pasa a ser asunto
tuyo. Pero son restricciones de datos, y los datos se pueden probar. Es el
contrato que llevaba esperando veinte años.

## Lo que nunca cambió

Diez años, y la sustancia no se movió. Medir sigue siendo un acto tipográfico,
no una hazaña técnica. El alemán sigue desbordando, el chino sigue ignorando los
espacios, y un corte mal colocado sigue siendo una falta de gusto en las siete
lenguas de este sitio. En Chengdu, el texto latino y el chino se cruzan cada día
ante mis ojos: ya no necesito un informe de errores para saber que las reglas de
corte no son las mismas — las leo en los menús de los restaurantes.

Una constante más: la medición es un contrato con el lector. Un nombre truncado
en un informe bancario no es un defecto cosmético, es una quebradura de
confianza — como un importe redondeado sin avisar. Por eso sigo comprobando
estas cifras con mis propias manos, con el mismo reflejo de la conciliación
contable: una cifra producida de forma síncrona por el motor de maquetación es
una cifra cuyo coste se esconde en otra línea de las cuentas.

## Lo que me llevo

Las herramientas cambiaron dos veces en diez años; la disciplina, nunca. Medid
con la fuente real. No os fiéis jamás de una cifra cuyo coste no habéis visto.
Pagad una vez, en la preparación, y mantened la lectura gratis. Este sitio mide
su título y su navegación con [pretext](https://github.com/chenglou/pretext),
que prepara una vez y después solo hace aritmética: diez años después de aquel
primer `getBoundingClientRect`, la regla ya no vive en el documento. Vive en los
datos, que es donde debí haberla buscado en 2016.
