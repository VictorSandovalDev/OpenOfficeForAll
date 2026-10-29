# Comparación directa con Gather 2.0

Comparación inicial: 26 de octubre de 2026. Ampliada mediante inspección los días 26 y 27.

Referencia inspeccionada: aplicación instalada `/Applications/GatherV2.app`, espacio «Vivo» facilitado por el usuario. Comparación contra la aplicación local `http://127.0.0.1:5173/`.

## Resultado

### Vista de reunión, chat, calendario, actividad, avatar y despliegue, 29 de octubre

Cada pantalla se midió en la referencia antes de construirla (tamaños, radios, colores y textos):

- **Vista de reunión**: escenario oscuro con mosaico, panel lateral de 320 px (#171717, borde #ffffff0d, radio 8) con
  «Meeting Chat», «People» (botones «Add people» y «Meeting link», «Here now» con contador) y «Meeting Details»;
  botones de 36 px abajo a la derecha; selector «Office view / Meeting view» de 70 × 28 px.
- **Chat**: barra lateral con «Drafts», secciones «Channels» (#general, #social) y «Direct messages»; página del canal con
  encabezado de 16/700, presentación del canal, mensajes agrupados (avatar de 36 px, nombre 14/700, hora 12 px) y
  compositor de 84 px con botones de formato de 32 px. La oficina pasa a una tarjeta de 280 × 204 px en la esquina.
- **Calendario**: semana con 56 px por hora, columna de horas de 72 px, día actual en círculo #eb5252, línea roja de la
  hora, eventos con fondo azul grisáceo y texto 11/600 + 12/500, «Today», «New Meeting» y la lista «Scheduled / Meeting
  Notes». Los eventos de la referencia vienen del calendario de Google del usuario; aquí son reuniones de la oficina.
- **Actividad**: «Unreads» con interruptor, marcar todo como leído, elementos con icono de 36 px y punto azul.
- **Estado y perfil**: menú de 318 px con Active/Busy/Away y «Update your status»; «Edit Profile» con foto de perfil y
  avatar de 88 px y lápiz; «Edit Avatar» con categorías, cuadrícula de opciones, muestras de color, vista previa,
  descarga y aleatorio. El avatar se recolorea por zonas conservando el sombreado; los peinados y prendas distintos de la
  referencia no se replican todavía (solo colores, gafas y sombreros).
- **Despliegue**: clave de invitación, rol de administrador, TURN en tiempo de ejecución, cliente servido por el mismo
  proceso, Docker con Caddy y coturn (`docs/DEPLOY.md`).
- **Arte**: no hay selector. La oficina usa el paquete de arte local de `src/sprites/reference/` si existe (ignorado por git, nunca se publica); si no, el arte propio del proyecto, que es el que contiene el repositorio.
  del proyecto. En el modo original faltan las capas que dibujan la silla por delante del avatar y algunas orientaciones
  usan el dibujo en código.

### Salas de reunión y muros, 29 de octubre

- Muros: en la referencia el borde superior de una sala oculta a quien está en la fila justo encima y muestra a quien
  está en su propia fila; el borde inferior oculta a quien está en la última fila de la sala. Las bandas de muro se
  ordenan así (`N_WALL_DEPTH`, `S_WALL_DEPTH`) y los objetos colgados en la pared (televisor, cuadros, estanterías) se
  dibujan justo sobre la banda, también cuando dos salas comparten la línea de muro.
- Salas de reunión, observadas en la referencia con el usuario en el Lobby: al pasar el ratón aparece
  «Meeting room: Media room»; al hacer clic, una tarjeta de 320 px (fondo #171717, radio 16, relleno 12) con icono,
  nombre, «Meeting Room», botón primario «Start meeting» (#303fe0, radio 10, 32 px) y dos botones de 32 px (#262626):
  compartir y editar. «Start meeting» lleva el avatar a una silla de la mesa; aparece la barra superior con la píldora
  «Media room» y el candado (28 px, #ffffff0d), y a la derecha «Copy meeting link», que copia
  `…/meeting/<id>` y avisa «Meeting link copied to clipboard». El candado bloquea («Locked - this meeting is now
  private»), se pone rojo y cada puerta muestra un candado rojo; las puertas de la sala se cierran mientras hay reunión.
  El carril muestra «Meeting» y la barra inferior añade mano levantada y «Back to my desk» (⌘ D). El chat de la
  reunión registra «victor joined», «locked the meeting», «unlocked the meeting».
- Replicado: tarjeta con nombre editable (persistido por oficina), inicio que sienta en la silla más cercana a la
  mesa, barra con candado y enlace `?meeting=<sala>` que sienta al invitado al llegar, puertas cerradas y candados,
  bloqueo aplicado por el servidor (`meeting_locked`) y por el cliente (la sala deja de ser transitable), chat de
  reunión con avisos del sistema, elemento «Reunión» en el carril y «Volver a mi escritorio». No replicado todavía:
  la vista de reunión a pantalla completa, música, ventana emergente y grabación.

### Reconstrucción con la geometría exacta, 28 de octubre (noche)

Se inspeccionó la aplicación de escritorio instalada mediante el protocolo de depuración
de Electron, sin controlar la pantalla, y se extrajo del espacio «Vivo» (web build
`edf006d4f`, 2026-10-28): dimensiones del mundo, 22 áreas con tipo, suelo, color, paredes y
puertas, 203 objetos con familia, tipo, color, orientación, posición, origen, baldosas de
asiento y de colisión, el mapa de colisión (93 baldosas) y los bordes bloqueados por paredes
(220), además de medidas de la interfaz y una captura 1:1 del mapa completo. Todo está en
`docs/references/vivo/` y el proyecto lo consume desde `shared/vivo-map.js`.

- Paredes, puertas, colisiones y asientos coinciden exactamente con la referencia (prueba automática).
- Movimiento por baldosas a 142,86 ms por paso, como el original; el avatar se dibuja 1:1 sobre la rejilla de 32 px.
- Suelos y paredes se dibujan con las paletas medidas; los muebles son dibujos propios en código con las dimensiones del objeto original; árboles, plantas y estanque se generaron con PixelLab usando las referencias como guía de estilo.
- Césped con textura (decisión del usuario, en lugar del verde liso de la referencia) y segunda pasada de detalle en escritorios, sillas, ventanas, estanterías, cocina, sofás y televisor.
- Interfaz ajustada a las medidas tomadas: carril de 60 px, panel de 292 px con radio 16, lienzo del mapa con radio 16, barra inferior de 48 px con botones de 36 px y radio 14, controles de zoom de 28 px y minimapa de 108 × 84; paleta oscura #151515 / #1c1c1c / #303fe0 y tipografía Inter. Captura: `docs/screenshots/vivo-rebuild-dark.png`.
- Mobiliario generado con PixelLab a partir de cada referencia (orientación por orientación) y preferido sobre los dibujos en código cuando el resultado es fiel; las estanterías altas se mantienen dibujadas porque la generación salió en perspectiva lateral.
- Decisiones del usuario que se apartan de la referencia: césped con textura en vez del verde liso, y un portátil sobre cada escritorio (`EXTRA_OBJECTS` en `shared/vivo-map.js`, generado por el script). Las puertas no se dibujan: la referencia solo marca el hueco.
- Orden de profundidad: las franjas de pared se dibujan antes que los objetos montados en ellas (ventanas, televisor, cuadros, armarios), y una silla vista de espaldas (ocupante mirando al norte) se dibuja delante del avatar sentado.
- Proporciones: el avatar de la referencia mide 20 × 34 px frente a muebles de la misma escala (silla 24 × 23). Cliente Avatar mide 21 × 46, así que se dibuja a 34/46 y el zoom por defecto pasa a 135 %: el avatar conserva en pantalla el tamaño elegido por el usuario y el mobiliario recupera la relación de la referencia.
- Comparación directa a 1:1 (`docs/screenshots/compare-building-reference-vs-ours.png`): el mobiliario se transcribió píxel a píxel desde la referencia (`src/sprites/referenceObjects.ts`, 94 piezas) y los suelos desde sus baldosas (`src/sprites/referenceFloors.ts`), porque las generaciones de PixelLab no alcanzaban la fidelidad exigida en sillas y mesas. Árboles, plantas y estanque siguen siendo los generados. Las paredes mantienen su cara en los huecos de puerta y los objetos hijos (tazas, tabletas, cafeteras) se dibujan sobre su objeto padre.
- Aviso de licencia: esas transcripciones reproducen arte de Gather y deben reemplazarse por arte propio antes de redistribuir el proyecto.
- Decorador: catálogo generado desde el catálogo completo de la referencia (`docs/references/vivo/catalog-variants.json`, 251 variantes de 81 piezas, 70 de ellas con varias orientaciones), con la regla de colocación de Gather: la esquina superior izquierda del sprite va en una baldosa más su desplazamiento, y las huellas de colisión y asiento salen de los puntos del catálogo. Cada orientación tiene su sprite y, cuando existe, su capa foreground (37). Colocación por baldosa con previsualización, giro con R, selección de lo colocado para girar o borrar, y validación en servidor. Los objetos originales del mapa también se seleccionan, giran, se arrastran para moverlos y se borran (cambios guardados como *overrides* que el servidor valida y persiste). Con el decorador abierto no se camina, el mapa se oscurece y muestra la rejilla de baldosas, y las zonas de asiento no capturan clics. Auditoría automática: las 58 sillas de la referencia y las añadidas aceptan sentarse (`docs/screenshots/seats-audit.png`).
- Puertas: comparadas hueco a hueco con la referencia. Gather no dibuja la cara de la pared en el hueco: se ve el suelo contiguo, y solo la sala de reuniones grande lleva hojas de puerta de madera abiertas (postes a ambos lados); los huddles llevan una marca clara en sus huecos verticales y el resto de accesos son huecos limpios. Así se dibuja ahora; los bordes bloqueados siguen siendo los 220 medidos.
- Asientos: Gather dibuja cada asiento en dos capas, la principal detrás del ocupante y un «foreground» (respaldo, brazos, borde del puff) encima. Se extrajeron las 20 capas foreground de la referencia (`src/sprites/referenceForegrounds.ts`) y se dibujan sobre el avatar sentado (`docs/screenshots/seats-foreground.png`). Las vistas laterales sentadas usan una pose con rodillas dobladas generada en PixelLab; la referencia mantiene la pose de pie sobre la silla en las vistas frontal y trasera.
- Escala: decisión del usuario, el avatar se dibuja a su tamaño nativo (cuerpo de 46 px) aunque la referencia usa personas de 34 px junto a sillas de 23; el zoom por defecto es 135 %. Los portátiles añadidos a los escritorios miran al espectador.
- Pendiente: iconos de calendario y actividad con contenido real, chat con canales tipo Slack, áreas seleccionables con configuración y chat propio, y el sistema de avatares con ropa.


La versión local actual sigue siendo un prototipo funcional; **no alcanza paridad visual ni funcional con Gather**. El 27 de octubre se sustituyó la escena suave inicial por una reconstrucción en pixel art y se rehízo la estructura de la interfaz.

### Refinamiento del mapa completo, 28 de octubre

La inspección de la aplicación abierta mostró una paleta y unos materiales
distintos de la captura clara inicial: madera cálida, paredes gris pizarra,
ventanas cian, sofás azules y asientos centrales de color caramelo. Se usó esa
referencia para corregir conjuntamente el resto del mapa:

- Madera con tablas estrechas y juntas escalonadas; alfombras oscuras con trama
  amplia y una alfombra de rombos en el lounge inferior.
- Escritorios con cajoneras, sillas de malla, estantes, mesas y sofás con contornos
  definidos y caras frontales más visibles. Paredes de 80 unidades de altura.
- Plantas con sombras y árboles con masas de hojas; lámpara de cinco bombillas.
- Televisor, cuadros y paneles de notas montados sobre las paredes. Se corrigió
  su orden de dibujo para que la pared no ocultara los paneles de notas.

Son dibujos propios en una cuadrícula fina. Se conserva el personaje seleccionado
de 92 × 92 y no se consumieron nuevas generaciones de PixelLab para este ajuste.
La distribución y el catálogo de objetos todavía presentan diferencias respecto
al original; esta revisión no demuestra una coincidencia exacta.

Compilación correcta y 14 pruebas aprobadas. En navegador se comprobó la llegada
del personaje a la sala de reuniones en `(1246, 900)` y no se registraron errores
de consola. [Vista general revisada](screenshots/map-overview-refined.png).

### Sillas, jardín y colisiones, segunda revisión del 28 de octubre

- Se incorporaron 30 sillas fijas, incluidas seis en el jardín, y las sillas
  colocadas por el usuario al mismo modelo de asientos. Un clic camina hasta el
  lado accesible y sienta al personaje mirando hacia la mesa o el estanque.
  E permite sentarse cerca y levantarse; caminar también libera la silla.
- Se reutilizan cuatro poses sentadas existentes de Cliente Avatar. Para mirar
  al norte se dibuja el respaldo delante del cuerpo. El servidor valida cercanía,
  acceso sin atravesar paredes y ocupación exclusiva, y comparte la postura.
- La inspección cercana del estanque real confirmó un aro compacto de piedras
  grises, koi naranjas, agua azul verdosa, helechos y sillas. Se sustituyó el
  estanque ovalado anterior por esa composición con dibujos propios. Se añadieron
  copas de hoja ancha, coníferas y abedules de tronco claro.
- Se añadieron las huellas que faltaban de la pared sur del lounge, laterales del
  edificio, sillas, macetas, estantería, pufs y lámpara. El agua del estanque tiene
  bloqueo propio, con el jardín transitable alrededor. Las colisiones corresponden
  a la base de los objetos; la altura visible se resuelve con la profundidad.
- La búsqueda de rutas pasó de una cuadrícula de 24 a 16 unidades. Se ajustó la
  fila trasera de la reunión para dejar una entrada accesible. Las 30 salidas son
  transitables desde el punto inicial y no exigen cruzar muebles.

Verificación: compilación y 21 pruebas correctas, incluidas ocupación concurrente,
orientación, salida, eliminación de una silla ocupada y regresiones de paredes,
macetas y agua. En navegador se verificaron las posturas norte y sur, levantarse
con E y detenerse al caminar contra una silla. [Postura en el jardín](screenshots/garden-seated-south.png).
Las medidas y el catálogo todavía no coinciden exactamente con Gather; no se ha
medido una reproducción píxel a píxel. El servidor de este prototipo valida los
asientos, pero el movimiento general todavía no es una simulación física
autoritativa frente a clientes modificados.

### Revisión de recorridos y decoración, 28 de octubre

La revisión posterior encontró tres fallos que no cubrían los tests iniciales de
búsqueda de rutas. Se corrigieron:

- El movimiento giraba al quedar a menos de cuatro unidades de un punto. Ese
  recorte producía atascos en esquinas y algunas llegadas fuera del radio de la
  silla. Ahora completa cada tramo y comprueba el segmento recorrido, con
  deslizamiento junto a una pared para el movimiento por teclado.
- Las salidas alternativas de una silla podían saltar al otro lado de una pared.
  Ahora deben conservar una conexión válida con su salida original respecto a
  los obstáculos fijos. Una silla colocada dentro de una pared no se puede usar.
- Colocar una planta o mesa sobre una persona de pie podía encerrarla. El servidor
  rechaza esa colocación y mantiene la protección de salidas para personas
  sentadas. Las huellas de objetos añadidos se comparten entre servidor y escena.

Se comparó una simulación de 930 recorridos (del punto inicial y de cada salida
hacia las treinta sillas): antes aparecían 63 atascos o aproximaciones inválidas;
después, ninguno. La suite actual tiene 29 pruebas correctas y la compilación pasa.
Esta simulación verifica movimiento y geometría; no constituye una comparación
visual automática con Gather. También se comprobó en navegador la silla lateral
que antes terminaba fuera del radio permitido.

### Reconstrucción visual del 27 de octubre

- Carril de 59 px, panel de 292 px, tarjeta de invitación superior y controles flotantes dentro del mapa.
- Plano de diez puestos (cuatro privados y seis Team), estanque, cuatro huddles, lounge y reunión inferior. Las proporciones se reconstruyeron a partir de observaciones; no se midieron todos los elementos del original.
- Mobiliario original con superficies y frentes, texturas de madera y alfombra, y orden común por profundidad para muebles y avatares.
- Avatar original generado con PixelLab, cuatro direcciones y cuatro fotogramas de marcha por dirección. El mismo personaje provisional representa a todas las personas; el editor de apariencia completo sigue pendiente.
- Minimapa con encuadre de cámara y participantes; clic para desplazar la vista. Zoom vertical y tema sistema/claro/oscuro.
- Zona de reunión trasladada también en servidor y cliente. Catorce pruebas de navegación, aislamiento y protocolo aprobadas; compilación correcta.

Se utilizaron siete generaciones de la suscripción PixelLab: personaje, cuatro direcciones de marcha, una dracaena detallada y un escritorio de prueba descartado por su perspectiva diagonal. El escritorio generado no se incorporó. La aplicación sirve los sprites localmente y no consume PixelLab durante su uso.

### Refinamiento solicitado sobre el tamaño del píxel

La primera reconstrucción usaba bloques de cuatro unidades que se veían demasiado gruesos. A partir de la imagen aportada por el usuario se redibujaron muebles, vegetación, lámparas y mesas con contornos de una a dos unidades, curvas escalonadas más finas, costuras, malla de sillas, hojas y nervaduras. También se aumentó la densidad de las alfombras y se redujo la escala del avatar. No se aplicó desenfoque ni se presentó un cambio de zoom como sustituto del detalle.

Comprobación final: compilación y catorce pruebas correctas; sin errores de consola en la pestaña de revisión. La ruta hacia la reunión llegó a `(1246, 900)` con el avatar dentro del encuadre y detenido al finalizar. El seguimiento de cámara conserva la exploración manual mientras el personaje está quieto. [Captura del acabado refinado](screenshots/refined-pixel-art.png). El audio/vídeo real sigue pendiente de una prueba con dos participantes.

### Personaje elegido: Cliente Avatar

Se sustituyó el personaje provisional por «Cliente Avatar», seleccionado por el
usuario en su cuenta PixelLab: PNG originales de 92 × 92, solo cuatro direcciones
(frente, espalda, izquierda y derecha) y seis fotogramas de marcha por dirección.
Las diagonales no se cargan en la aplicación. Se reutilizaron los recursos
existentes sin nuevas generaciones. La guía y los anclajes están en
[ESTILO-AVATAR.md](ESTILO-AVATAR.md).

Se observaron directamente la oficina, chat, calendario, actividad, perfil/avatar, ajustes, invitaciones, Gather Studio, Desk Manager y Decorator. El inventario y los límites de cada comprobación están en [la auditoría ampliada](AUDITORIA-GATHER-2.md). La aplicación de escritorio instalada es la versión 0.55.2 según su `Info.plist`; no se ha identificado el build del contenido web.

No se publicaron cambios de objetos, asignaciones ni miembros, ni se enviaron mensajes. Abrir un aviso lo marcó como leído. Desk Manager cambió temporalmente el estado a Away; al cerrarlo se verificó el regreso a Active.

## Diferencias observadas en el prototipo inicial

Esta tabla conserva la comparación que motivó la reconstrucción. La columna local describe el estado previo del 26 de octubre; los cambios implementados después se enumeran arriba. Las funciones no mencionadas como implementadas siguen pendientes.

| Área | Original observado | Prototipo inicial | Corrección identificada |
| --- | --- | --- | --- |
| Estructura | Carril estrecho de iconos, panel lateral redondeado y mapa que empieza arriba; tema System, oscuro en la inspección ampliada | Encabezado horizontal, panel rectangular y barra inferior fija | Rehacer la estructura y comparar bajo el mismo tema |
| Dimensiones laterales | En la captura de 1147×685, carril de unos 59 px; panel desde x≈59 a x≈351; mapa desde x≈358 | Carril de 72 px; panel de 250 px; encabezado de 73 px y pie de 78 px | Ajustar tamaños, espacios y proporciones a la referencia |
| Navegación | Logo/menú, búsqueda, oficina, chat, calendario, actividad; accesos inferiores | Oficina, chat, decorar, tema y ayuda | Igualar orden y posición; implementar las vistas que faltan |
| Panel de oficina | Nombre «Vivo», selector de piso, invitación destacada arriba, búsqueda y lista Online | Nombre genérico en encabezado, personas, lista de tres espacios e invitación abajo | Reconstruir jerarquía y contenido |
| Estilo del mapa | Pixel art: textura de ladrillo/madera, mobiliario con bordes y detalle de píxel, alfombras azul/violeta y salas diferenciadas | SVG suave con curvas, paleta pastel y mobiliario propio | Crear recursos originales de pixel art y un renderizado nítido |
| Tamaño del mundo | Oficina amplia recortada por la cámara; se ven zonas que continúan fuera de pantalla | Plano pequeño casi completo en pantalla | Reconstruir el plano y la escala del mundo; ajustar cámara y zoom |
| Distribución | Plano completo visto en Studio: seis puestos Team, cuatro puestos privados superiores, estanque, áreas laterales de conversación, lounge y sala inferior | Cuatro grupos de escritorios, una sala y un lounge con otra distribución | Medir el plano observado y reconstruir sus proporciones |
| Avatar | Sprite y etiqueta compacta encima; editor con once categorías de piel, pelo, ropa, accesorios y disfraces | Personaje vectorial frontal fijo y etiqueta debajo | Rehacer personalización, dirección, escala, animaciones y etiqueta |
| Profundidad | El arte representa superficies y frentes; la oclusión en movimiento requiere una prueba controlada | Los avatares se dibujan después de todos los muebles y solo se ordenan entre sí por Y | Ordenar objetos y personajes juntos y comprobar superposiciones |
| Controles de llamada | Barra oscura flotante dentro del mapa; avatar, micrófono, cámara, reacciones y salida | Pie blanco fijo con controles y texto | Cambiar composición, color, ubicación y opciones |
| Minimapa | Visible abajo a la izquierda, con posición y zonas; también permanece accesible desde Chat | No implementado | Añadir minimapa funcional sincronizado con mundo y cámara |
| Zoom | Controles oscuros verticales en el borde inferior derecho | Barra blanca horizontal | Reubicar y reconstruir controles y selector de vistas |
| Chat | Vista completa: canales general/social, mensajes directos, borradores, cabecera, editor con adjuntos, menciones, emoji y formato | Panel estrecho con chat general/cercano y campo de texto simple | Implementar navegación y modelo de conversaciones del original |
| Editor | Studio en Chrome con pisos, catálogo, áreas, texturas y variantes; Desk Manager con asignaciones/publicación; Decorator personal | Panel que coloca cuatro tipos de objetos | Implementar los tres flujos, sus permisos y modelos de datos |
| Calendario y actividad | Calendario semanal, Scheduled/Meeting Notes y feed de actividad con filtro de no leídos; mapa y controles en una esquina | Sin implementar | Reproducir las pantallas e integrar sus flujos; creación de reunión aún no verificada |
| Ajustes y administración | Preferencias de audio/vídeo, reuniones, notificaciones, privacidad, rendimiento, integraciones, miembros, invitados, conversación y Smart Objects | Controles básicos y preferencias locales | Implementar cada área y probar sus efectos, además de su interfaz |

## Alcance de la evidencia

- Oficina: comparada mediante captura visible del original y de la aplicación local.
- Chat: comprobados pantalla visible y controles accesibles del original.
- Edición: inspeccionados Studio, propiedades de pisos, selección de áreas/objetos, catálogo, Desk Manager y Decorator. No se probaron operaciones de creación, movimiento, eliminación ni publicación en el espacio real.
- Studio usa actualmente layout Hybrid, tema Startup y tamaño 10. Guardar cambios de propiedades del piso avisa que borra asignaciones y decoraciones; no se ejecutó.
- Se cerraron Studio y los paneles de edición al finalizar su revisión, sin publicar cambios.
- Las dos capturas tienen dimensiones diferentes. Las coordenadas anteriores describen la referencia; no constituyen una diferencia automática píxel a píxel.
- No hay un porcentaje de fidelidad medido. Asignarlo ahora sería inventarlo.
- Las llamadas, proximidad real, bloqueos, permisos y persistencia de Gather no se han comparado todavía con dos participantes.

## Orden de corrección

1. Igualar estructura de ventana, panel lateral, controles flotantes, minimapa y zoom.
2. Medir el plano completo ya observado de «Vivo» y reemplazar la escena provisional por recursos propios de pixel art.
3. Reproducir estados y animaciones de avatar, cámara, movimiento e interacción.
4. Completar chat, perfil, calendario, actividad y herramientas de edición contra las pantallas originales.
5. Comprobar audio/vídeo y privacidad con dos sesiones antes de afirmar paridad funcional.

El enlace de invitación y sus identificadores no se incluyen en el código ni en esta documentación.
