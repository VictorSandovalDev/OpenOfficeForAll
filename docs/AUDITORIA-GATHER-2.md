# Auditoría de Gather 2.0 y del prototipo local

Observaciones principales: 26 de octubre de 2026. Continuación de la auditoría: 27 de octubre de 2026.

Referencia: aplicación Gather Desktop instalada, versión 0.55.2, espacio «Vivo», con una sesión abierta y un participante activo. La versión se verificó con PlistBuddy en `/Applications/GatherV2.app/Contents/Info.plist`: `CFBundleShortVersionString` y `CFBundleVersion` valen `0.55.2`. El build del contenido web y de Studio no está identificado. El original se inspeccionó en inglés. Su tema estaba en `System` y se veía oscuro. Este documento recoge la inspección directa comunicada por el agente que controló la aplicación y una revisión de solo lectura del código del prototipo.

**La auditoría no demuestra una equivalencia del 100 %.** Ver una opción en la interfaz acredita su presencia, pero no prueba su funcionamiento ni su comportamiento entre varios participantes. No se asigna un porcentaje de fidelidad.

## Estados de evidencia

- **OBSERVADO:** pantalla, control, texto o comportamiento visto directamente; en el prototipo, implementación localizada en el código.
- **NO PROBADO:** función identificada cuya ejecución o resultado completo no se ha verificado.
- **PENDIENTE:** área aún por inspeccionar o diferencia que necesita una comprobación adicional.

## Inspección directa del original

| Área | Estado | Evidencia observada y límite |
| --- | --- | --- |
| Estructura de la oficina | OBSERVADO | Referencia del 26 de octubre: ventana de 1147 × 685 px. Carril lateral de aproximadamente 59 px; panel entre x≈59 y x≈351; mapa entre x≈358 y x≈1141, de y≈26 a y≈678. Controles de audio y vídeo flotantes y minimapa. El 27 de octubre se obtuvo además una captura de 1405 × 768 px. Los tamaños difieren: no constituyen una comparación píxel a píxel. Las medidas son aproximadas y corresponden a la primera referencia. |
| Identidad gráfica | OBSERVADO | Pixel art con vista superior en tres cuartos. Se ven superficies superiores y frentes del mobiliario, además de paredes. No es una cuadrícula isométrica en rombo. |
| Menú principal | OBSERVADO | Accesos a Invite, Settings, lobby, Decorate desk, Desk manager, Edit office, billing y leave. La existencia del acceso no acredita haber completado cada flujo. |
| Búsqueda universal | OBSERVADO | Inspeccionada el 27 de octubre: Find anything, Close Esc y Select. La consulta `desk` mostró Open Desk Decorator y Coffee Huddle. No se ejecutaron los resultados. |
| Invite Collaborators | OBSERVADO | Inspeccionado el 27 de octubre, con pestañas Members y Guests. La interfaz indica que un miembro puede tener escritorio y decorarlo; muestra enlace y acciones Copy, Reset link, Invite email, Invite desk, Manage members y Domain membership. Para invitados indica admisión por otra persona y que no pueden reclamar ni decorar escritorio. No se compartieron enlaces ni se enviaron invitaciones; los permisos efectivos y la admisión están NO PROBADO. |
| Desk Manager | OBSERVADO | Inspeccionado el 27 de octubre. Al abrirlo aparece un aviso de estado Away y bloqueo de edición/reclamación de escritorios. Tras Got it, panel derecho con Add, Publish deshabilitado, Search people, Overview y Desk assignments; Team mostraba cinco escritorios disponibles y una persona asignada. El plano resaltó diez puestos: cuatro privados superiores y seis de equipo. Al cerrar con X se verificó la restauración de Active. Asignación y publicación: NO PROBADO. |
| Desk Manager: añadir miembros | OBSERVADO | Add abre Add new members, campo Emails y Add 0 deshabilitado. El texto indica que los correos se invitan al publicar. Se canceló sin añadir miembros ni publicar. No se consignan datos de cuentas. |
| Decorate desk | OBSERVADO | Inspeccionado el 27 de octubre. Abre Decorator a la derecha y acerca automáticamente el mapa al puesto propio. Muestra Search for a decoration, categorías, catálogo, variantes, color, rotar/eliminar, deshacer/rehacer y Objects used del 13 %. No se colocó ningún objeto y se cerró Decorator. Operaciones de decoración: NO PROBADO. |
| General | OBSERVADO | Opciones para omitir la bienvenida, actualizaciones automáticas, idioma y color `System`. |
| Audio | OBSERVADO | Controles de reducción de ruido, ganancia automática, cancelación de eco, volumen y escucha automática. Silenciado al cambiar de aplicación con excepciones para reuniones/coworking, silencio del chat y sonidos de pasos, aplausos y ascensor. Calidad y efecto real: NO PROBADO. |
| Menú del micrófono | OBSERVADO | Inspeccionado el 27 de octubre. Selectores de micrófono y altavoz, System Default, lista de dispositivos, reducción de ruido y Audio Settings. No se activó el micrófono ni se concedieron permisos. Esto no verifica captura, hardware ni transmisión; se omiten nombres de dispositivos concretos. |
| Video | OBSERVADO | HD, retoque `Beta`, fondo ninguno/desenfoque/fondos disponibles y carga de fondo. Captura y aplicación efectiva: NO PROBADO. |
| Meetings | OBSERVADO | Bloqueo automático del escritorio impuesto por el administrador, bajar la mano, idioma de grabación, pantalla compartida HD, selector nativo de macOS, vista automática de reunión, máximo de 25 personas y ocultar la propia imagen. Reuniones reales: NO PROBADO. |
| Notifications | OBSERVADO | Alcance de avisos de proximidad/equipo/ninguno, recordatorios del calendario, avisos de DM/menciones/respuestas, móvil y sonido por separado. Entrega de avisos: NO PROBADO. |
| Integrations | OBSERVADO | Google Calendar, Spotify y GitHub aparecen en la interfaz. Conexiones o sincronización: NO PROBADO. |
| Privacy | OBSERVADO | Opción para compartir la aplicación enfocada cada 30 segundos y lista de aplicaciones. No se probó ni se verificó la transmisión de esa información. |
| Performance | OBSERVADO | Modos Quality, Balanced y Efficient, ajuste automático y aceleración por hardware. Efecto sobre rendimiento: NO PROBADO. |
| Calendar settings | OBSERVADO | Reuniones externas con estado ocupado automático y desplazamiento a sala/escritorio; semana de siete días, inicio en domingo y estados inteligentes por palabras como lunch, dinner, focus o vacation. Automatismos: NO PROBADO. |
| Mini Mode | OBSERVADO | Ajustes de mantener encima y apertura automática durante reuniones, al quitar el silencio o al estar en el escritorio. Solo se inspeccionaron los ajustes; funcionamiento del modo: NO PROBADO. |
| Office Conversations | OBSERVADO | Audio/vídeo ambiental, alcance Short/Long, bloqueo automático para todos, transcripción, notas con IA y anuncios del administrador, estos últimos desactivados en la pantalla observada. Conversaciones y efectos: NO PROBADO. |
| Chat settings | OBSERVADO | La interfaz describe canales públicos y privados persistentes, chat de reunión, chat cercano transitorio y mensajes directos. Persistencia y entrega: NO PROBADO; la descripción se basa en el texto mostrado. |
| Security | OBSERVADO | Incorporación automática por dominio de empresa, acceso de soporte, invitaciones de miembros, restablecimiento de enlaces de invitación y acceso de invitados. No se cambiaron estas opciones. |
| Manage Members | OBSERVADO | Tabla con Name, Role y Last Active; un administrador visible. Se omiten los datos de la cuenta. |
| Manage Guests | OBSERVADO | Vistas All, Active, Expired, Revoked y Archived. No se invitó, revocó ni archivó a nadie. |
| Smart Objects | OBSERVADO | Webhooks habilitados en la interfaz, lista/búsqueda, campos de nombre, Added, Last event y acción Add. Creación y ejecución: NO PROBADO. |
| Calendario | OBSERVADO | Semana del 25 al 31 de octubre, Today, anterior/siguiente, New meeting y cero calendarios. Vistas Scheduled y Meeting Notes; mapa y controles de audio/vídeo en una esquina. |
| Crear reunión | PENDIENTE | New meeting abrió un estado de carga. El formulario no quedó verificado y no se creó ningún evento. |
| Activity | OBSERVADO | Filtro Unread, aviso de escritorio listo y actividad de chat. Se abrió un tutorial sobre el escritorio como base, presencia y decoración. Abrir un aviso marcó uno como leído. No se enviaron mensajes. |
| Perfil | OBSERVADO | Estados Active, Busy y Away; opciones para editar foto, avatar, nombre y zona horaria. No se guardaron cambios de perfil. |
| Editor de avatar | OBSERVADO | Once pestañas: Skin, Hair, Facial hair, Top, Jacket, Bottom, Shoes, Hat, Glasses, Other y Costume. Skin mostraba cinco variantes y cinco tonos; Top ofrecía numerosas prendas. No se seleccionaron recursos. Al salir apareció un aviso de cambios sin guardar; se eligió Leave y se cerró el perfil sin Save. |
| Studio: acceso | OBSERVADO | Edit office abrió el editor real en Chrome. Se omite su dirección privada. La bienvenida `Beta` describe arrastrar salas/escritorios/decoración, redimensionar, editar, mover, añadir/duplicar/editar pisos, asignar escritorios y crear áreas de equipo. El texto indica que los cambios solo pasan al espacio activo al pulsar Publish. Al retomar el 27 de octubre, apareció un aviso de que la sesión anterior había terminado inesperadamente; Refresh volvió a abrir Studio. |
| Studio: controles | OBSERVADO | Búsqueda y categorías laterales; catálogo con Public Room, Meeting Room, Private Desk, Team Area, Coworking Area y Open Desk. Iconos de deshacer/rehacer y pisos. Indicador Objects used del 13 %. Operaciones de edición: NO PROBADO. |
| Studio: plano | OBSERVADO | Plano completo visible: lounge central y equipo de seis escritorios; cuatro puestos privados superiores en cuatro cubículos, para un total de diez puestos; estanque de peces al norte del centro; espacios laterales de conversación; lounge/mesa inferior izquierda; sala inferior derecha con mesa y sillas rojas (conteo exacto pendiente); árboles alrededor. El conteo de puestos quedó contrastado con Desk Manager el 27 de octubre. No se han medido coordenadas, tamaños ni recursos individuales. |
| Studio: bloqueo temporal | OBSERVADO | Aviso de que mantener Studio abierto bloquea la decoración/edición para otras personas. No se comprobó desde una segunda cuenta. |
| Studio: pisos y propiedades | OBSERVADO | Inspeccionado el 27 de octubre. Floors muestra Floor 1 y Add a New Floor; Floor options ofrece Edit floor name y Edit floor properties. El diálogo mostraba layout Hybrid, theme Startup, size 10 y default landing floor activado. El selector de layout ofrece Open, Private y Hybrid. Un aviso indica que guardar las propiedades borra asignaciones de escritorios y decoraciones. Solo se abrió el diálogo y se pulsó Cancel, sin Save. Crear/editar pisos: NO PROBADO. |
| Studio: área Team y suelos | OBSERVADO | Seleccionar el área Team muestra Area name, Floor con Current texture, Color y un icono de eliminar. El selector Floor contiene 18 texturas: Grass; alfombras Afghani, Couture, Curls, Diamond, Floral, Stripe y Wave; Damask; Stone Brick y Stone Tile; Tile Hex y Tile Two-tone; Wood Basketweave, Herringbone, Parquet, Slats y Spiral. No se aplicó una textura ni se cambió el área. |
| Studio: árbol y variantes | OBSERVADO | Seleccionar un árbol exterior muestra Variants, paleta/colores, rotar y eliminar. El menú Variants tiene once opciones con vista previa. Modificación, rotación y eliminación: NO PROBADO; no se hicieron cambios. |
| Studio: búsqueda del catálogo | OBSERVADO | Buscar `desk` devolvió veinte resultados, entre ellos Simple Desk, Office Desk, variantes antique/modern/executive, lámparas/ordenadores, Private Desk y Open Desk. Colocación de resultados: NO PROBADO. |
| Studio: salida | OBSERVADO | El 27 de octubre se verificó el cierre de la pestaña de Studio y la finalización de la sesión del editor, sin Publish. Se cerró la pestaña; no se verificó una acción con el nombre Exit Studio. |

## Matriz del prototipo local

La columna de implementación describe únicamente el repositorio revisado. Las referencias son relativas a este documento. No supone que cada función haya pasado una prueba de extremo a extremo.

| Área | Estado de evidencia | Implementación actual y diferencia pendiente | Referencia |
| --- | --- | --- | --- |
| Entrada y perfil | OBSERVADO | Nombre, seis colores y cuatro estados; preferencias locales. No hay cuentas ni identidad permanente. | [App.tsx](../src/App.tsx), [types.ts](../src/types.ts) |
| Presencia | OBSERVADO | WebSocket, alta/baja de sesiones, cambios de perfil, separación por oficina y reconexión automática. | [useOffice.ts](../src/useOffice.ts), [servidor](../server/index.mjs) |
| Movimiento | OBSERVADO | WASD/flechas, Shift, doble clic y rutas A* con colisiones locales. Regreso al escritorio conduce a un punto fijo; falta asignación de escritorios. | [OfficeScene.tsx](../src/OfficeScene.tsx), [navigation.ts](../src/navigation.ts) |
| Renderizado | OBSERVADO | Escena SVG original de 1600 × 1100 con arrastre, zoom y vista simplificada. Faltan pixel art, minimapa y varios pisos. | [OfficeScene.tsx](../src/OfficeScene.tsx), [scene.css](../src/scene.css) |
| Avatar | OBSERVADO | Figura vectorial frontal fija. Faltan dirección, ciclos de caminar, sentarse y personalización por prendas. | [OfficeScene.tsx](../src/OfficeScene.tsx), [types.ts](../src/types.ts) |
| Profundidad | OBSERVADO | Solo los avatares se ordenan por Y. Todos se dibujan después de los muebles: falta ordenar personajes y objetos juntos para ocultarlos correctamente entre sí. | [OfficeScene.tsx](../src/OfficeScene.tsx) |
| Estructura de interfaz | OBSERVADO | Carril, panel lateral, encabezado horizontal y pie fijo propios; todavía no coincide con la composición observada en Gather. | [App.tsx](../src/App.tsx), [styles.css](../src/styles.css) |
| Chat | OBSERVADO | Texto simple para oficina/cercanía. Radio cercano de 200 unidades con separación de una zona de reunión fija. Últimos 100 mensajes de oficina en memoria. Faltan historial persistente, canales configurables, DM, formato, adjuntos, menciones, borradores y reacciones. | [App.tsx](../src/App.tsx), [servidor](../server/index.mjs) |
| Audio, cámara y pantalla | NO PROBADO | Cliente WebRTC implementado, sin prueba real completa entre participantes. Requiere estado disponible y radio de 220 unidades o la misma zona fija de reunión. Pantalla sustituye el vídeo y no solicita audio del sistema. ICE vacío por defecto, configurable. | [useMedia.ts](../src/useMedia.ts) |
| Edición | OBSERVADO | Añadir/eliminar planta, silla, mesa o lámpara; persistencia JSON. Faltan mover/rotar/redimensionar objetos existentes, suelo/paredes, deshacer, pisos, administración de escritorios y permisos. | [App.tsx](../src/App.tsx), [servidor](../server/index.mjs) |
| Invitaciones | OBSERVADO | Copia un enlace local con identificador de oficina; no crea invitaciones protegidas ni administra su vigencia. | [App.tsx](../src/App.tsx) |
| Administración y seguridad de producto | PENDIENTE | Sin cuentas, roles, moderación, bloqueo de reuniones, gestión de miembros/invitados ni permisos de edición. Todos los clientes admitidos pueden modificar objetos. | [Documentación del servidor](../server/README.md) |
| Calendario, actividad e integraciones | PENDIENTE | No implementados en la interfaz ni en el protocolo local revisado. | [App.tsx](../src/App.tsx), [servidor](../server/index.mjs) |
| Ajustes de dispositivos | PENDIENTE | No hay selección de entrada/salida ni menús de ajustes de audio/vídeo equivalentes. Las flechas dibujadas en micrófono/cámara pertenecen al mismo botón de encendido/apagado. | [App.tsx](../src/App.tsx) |
| Pipeline de arte | PENDIENTE | El proyecto revisado contiene SVG propios; no contiene una integración de generación con PixelLab ni recursos pixel art producidos por ella. Esto no evalúa la configuración MCP externa al repositorio. | [README](../README.md), [OfficeScene.tsx](../src/OfficeScene.tsx) |

Dos detalles de implementación afectan a futuras pruebas funcionales:

- El indicador «cerca de ti» filtra por distancia y disponibilidad de la otra persona, pero omite la frontera de la sala y el estado propio. Puede discrepar de la elegibilidad real de audio calculada por el cliente y el servidor.
- El servidor limita las coordenadas al mapa, pero las colisiones y la velocidad solo se comprueban en el cliente. La sincronización no constituye una validación autoritativa de esas reglas.

## Verificación disponible y límites

El repositorio contiene siete pruebas de servidor y cinco de navegación. Cubren salud, identidades de sesión, coordenadas limitadas, perfiles, desconexión, aislamiento de oficinas/chat/señales, validación de mensajes, límites de zona y disponibilidad, persistencia de objetos, rechazo de orígenes/identificadores inválidos y rutas con obstáculos. No contienen pruebas de fidelidad visual ni de transmisión real de audio/vídeo.

El README registra una ejecución anterior correcta de las doce pruebas y de la compilación. No se repitieron durante esta revisión de solo lectura. La comparación previa también registra una comprobación de entrada y oficina en navegador; no equivale a haber probado todos los flujos del prototipo.

No se hicieron cambios publicados, llamadas de prueba con dos personas ni compras durante esta inspección del original. No se enviaron mensajes ni invitaciones, ni se compartieron enlaces. Se produjo el cambio de estado leído de un aviso al abrirlo. La salida de Studio quedó verificada el 27 de octubre cerrando su pestaña, sin Publish. Se inspeccionaron pisos, propiedades y selección de objetos sin guardar cambios; crear, eliminar, rotar, mover y publicar siguen sin probarse funcionalmente. Desk Manager se cerró con X y se verificó Active restaurado; Decorator también se cerró sin colocar objetos. La inspección del menú de audio no incluyó activación ni permisos, y no acredita el estado del hardware o una transmisión real.

Las opciones observadas en ajustes no prueban la entrega de notificaciones, sincronización de integraciones, grabación, transcripción, notas con IA, aislamiento de llamadas, permisos efectivos o persistencia del producto original. Esas áreas permanecen **NO PROBADO** hasta realizar un flujo completo con resultados verificables.

## Criterios de aceptación para evaluar fidelidad

1. Fijar la versión/build de referencia de Gather y del prototipo. Gather Desktop 0.55.2 quedó verificado en los metadatos `CFBundleShortVersionString` y `CFBundleVersion` de la aplicación instalada; no se infiere de su nombre. El build del contenido web y de Studio sigue sin identificar, por lo que el número de la aplicación no fija por sí solo todas las vistas auditadas.
2. Comparar capturas del mismo tamaño de ventana, escala de pantalla, idioma, tema explícito, estado de paneles y zoom. Existen referencias de 1147 × 685 px del 26 de octubre y 1405 × 768 px del 27: no son directamente comparables píxel a píxel. El tema System se veía oscuro y debe controlarse al repetir la prueba.
3. Capturar la misma zona del mapa, posición del avatar, dirección, estado de animación y contenido visible. Medir proporciones, plano, perspectiva, tamaño del píxel, capas, colores, tipografía y controles.
4. Generar comparaciones visuales por superposición y diferencia de capturas. Registrar cualquier máscara usada para regiones dinámicas; no ocultar diferencias con máscaras arbitrarias.
5. Mantener un registro de diferencias por pantalla y estado: oficina, perfil/avatar, chat, calendario, actividad, ajustes y Studio. Cada corrección necesita una captura o un resultado de flujo que la respalde.
6. Verificar funciones con escenarios reproducibles. Proximidad, cambios de zona, estados, audio/vídeo, pantalla, permisos y persistencia requieren al menos dos sesiones donde corresponda, con entrada, acción y resultado esperado documentados.
7. Distinguir paridad visual, paridad de flujos visibles y comportamiento interno desconocido. Una coincidencia de capturas no demuestra equivalencia de red, seguridad, rendimiento o arquitectura.

No hay todavía un score de fidelidad ni una diferencia automatizada de capturas comparable. Cualquier afirmación de exactitud debe vincularse a pantallas y escenarios medidos, no a una impresión general.

## Pendientes de continuación

- Preparar pruebas controladas de crear, eliminar, rotar, mover y publicar en Studio. La interfaz de pisos/propiedades y selección de objetos ya fue inspeccionada, y el cierre de Studio quedó verificado; las operaciones que modifican contenido siguen sin probarse.
- Completar el formulario New meeting si deja de mostrar carga, sin crear eventos durante la inspección.
- Medir el plano y los recursos de la oficina con una referencia de escala consistente.
- Preparar comparaciones a igual resolución/tema y pruebas funcionales controladas entre dos sesiones.

Este documento excluye correos, datos de cuenta, UUID, enlaces de invitación y direcciones privadas del espacio o del editor. Complementa [la comparación anterior](COMPARACION-GATHER-2.md); no la reemplaza ni modifica.
