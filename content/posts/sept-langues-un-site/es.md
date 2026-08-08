---
title: Siete idiomas, un solo sitio
date: 2025-10-03
summary: Una página por idioma, escrita para su público, nunca traducción automática: veinte años de software financiero y un 微辣 en Chengdu.
  tags: [multilinguisme, web]
---

Después de veinte años en el software financiero — primero como analista de
negocio, después como product owner — he aprendido a desconfiar de los
requisitos que caben en una frase. « El sitio tiene que ser multilingüe » es uno
de ellos. En apariencia, una casilla que marcar. En realidad, una decisión de
arquitectura, una postura editorial y una promesa hecha al lector.

## Una página por idioma

Este sitio habla siete idiomas: inglés, francés, portugués, español y tres
variantes de chino — 简体字 para el continente, 繁體字 para Taiwán, más una
proyección para Hong Kong. Cada idioma es una página estática completa, generada
de antemano. No hay máquina de traducción entre vosotros y yo: ni API de
traducción al cargar, ni JavaScript que reescriba la página mientras la leéis.
Cuando leéis la versión española, cada frase fue escrita para vosotros, no
convertida desde el inglés.

¿Por qué tanta exigencia? Porque vivo en Chengdu, y el chino me regaló la mejor
metáfora de mi carrera. En un restaurante de aquí pido 微辣 — « poco picante ».
El diccionario asiente: mildly spicy. Literal, correcto e inútil. El 微辣 de
aquí es una escala local, un convenio entre el cocinero y el cliente. La
traducción automática entrega las palabras y pierde el convenio, sin excepción.

## La lengua es parte de la lógica

Vi el mismo fracaso durante dos décadas en proyectos bancarios: especificaciones
« traducidas » hasta que la regla de negocio se les escapaba, pantallas donde
value date se convertía en date de valeur cuando el mercado dice date de
valorisation. La lengua de un producto no es un adorno; es parte de su lógica.

El diseño técnico sigue a la decisión editorial. Una página por idioma
significa: ningún estado compartido, ningún cambio que deje fragmentos de una
lengua dentro de otra, posicionamiento limpio con hreflang y negociación de
idioma solo en la raíz del sitio. Una URL que nombra un idioma jamás se
redirige: un enlace compartido debe seguir siendo el enlace que se compartió.

El coste es real: cada párrafo existe siete veces, y lo releo siete veces. Es el
precio de una promesa sencilla — 微辣 significa 微辣, y cuando este sitio os
habla en español, lo hace como quien vive la lengua, no como quien la alquila.
