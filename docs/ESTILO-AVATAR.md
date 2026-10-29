# Referencia elegida por el usuario: Cliente Avatar

Revisado directamente en la cuenta de PixelLab del usuario.

- Nombre: **Cliente Avatar**.
- Lienzo: **92 × 92 píxeles**, fondo transparente.
- Cámara: superior en tres cuartos (`low top-down`).
- El personaje original dispone de ocho direcciones; su marcha tiene seis
  fotogramas por dirección, además de reposo animado y estados de sentarse.
- El usuario eligió usar **solo cuatro direcciones** en la aplicación: sur,
  norte, este y oeste, con una vista estática de reposo y los seis fotogramas
  originales de marcha de cada dirección.

La dirección visual a seguir es su proporción compacta, cabeza expresiva,
contornos finos y oscuros, pequeñas zonas de luz y sombra y ropa legible.
Conservar el detalle de los sprites; no sustituirlo por bloques geométricos grandes.

El tamaño del lienzo incluye márgenes transparentes: en la vista sur el cuerpo
visible ocupa aproximadamente 21 × 46 píxeles, entre (36, 23) y (57, 69).
Los 28 archivos seleccionados se exportaron sin cambios a
`public/assets/pixel/cliente-avatar/`: cuatro vistas estáticas y 24 fotogramas de
marcha, todos comprobados a 92 × 92. Se conserva el lienzo completo con el
anclaje común de los pies **(46, 69)**. Los límites inferiores de la marcha
oscilan entre 67 y 69 según la dirección y el fotograma; se mantienen esas
pequeñas variaciones originales, sin recortar ni recentrar los archivos.
La escala en pantalla debe elegirse respecto a los muebles, sin confundir el
tamaño del lienzo con la altura visible del personaje. El cuerpo en reposo mide
45–46 píxeles de alto, aunque el lienzo sea de 92 × 92.

Se guardaron las ocho vistas originales en `references/cliente-avatar/` para
comparación. Las diagonales quedan como referencia visual y no forman parte de
la selección para la aplicación. La descarga reutiliza el personaje existente
del usuario y no ha consumido nuevas generaciones de PixelLab. El detalle de los
archivos y sus límites se documenta en
[`public/assets/pixel/cliente-avatar/README.md`](../public/assets/pixel/cliente-avatar/README.md).

Integrado en la oficina: `src/avatarSprite.ts` configura exclusivamente las cuatro
direcciones cardinales, marcha de seis fotogramas a 110 ms y anclaje (46, 69).
La escala de dibujo es 1,5 unidades de mundo por píxel fuente para conservar una
altura visible cercana a la del avatar anterior; los PNG originales siguen
midiendo 92 × 92. Se usa la misma secuencia en personajes locales y remotos.

## Postura sentada

Se incorporaron cuatro PNG sin modificar del estado existente «sitting down on a se»
(56b6106b-5d66-4c5d-b95e-1e2601b4c21d), que contiene únicamente el personaje.
La silla asigna su orientación y ordena base, avatar y respaldo al dibujarse.
Los asientos tienen ocupación exclusiva compartida por servidor; se accede a ellos
por una salida transitable antes de sentarse, y levantarse devuelve a ese punto.
