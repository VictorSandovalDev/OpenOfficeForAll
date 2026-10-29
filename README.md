# Open Office

Prototipo local de una oficina virtual de código abierto. Implementación propia inspirada en Gather 2.0. No afiliada a Gather y todavía sin paridad visual ni funcional.

## Ejecutar

Node.js 22.18 o superior (verificado con 26.8.1):

```sh
npm ci
npm run dev
```

Abre http://127.0.0.1:5173. El servidor de tiempo real usa 127.0.0.1:3001. Abre una segunda pestaña con otro nombre para comprobar presencia y chat. Ambas deben tener el mismo `?room=mi-oficina` (valor predeterminado).

## Funciones actuales

- Oficina «Vivo» reconstruida con la geometría medida en Gather 2.0: mundo de 52 × 50
  baldosas de 32 px, 22 áreas (suelos, paredes y puertas), 203 objetos en su posición
  exacta, 93 baldosas de colisión y 220 bordes de pared idénticos a la referencia
  (`docs/references/vivo/`). Movimiento por baldosas a 7 por segundo, cámara que sigue
  al avatar, zoom 36 %–400 % y minimapa.
- Personaje «Cliente Avatar» de PixelLab con cuatro direcciones y marcha de seis fotogramas,
  ordenados por profundidad junto con los muebles.
- 58 asientos fijos (los mismos que la referencia) y las sillas añadidas permiten sentarse
  con orientación y ocupación sincronizadas. Clic en una silla o E al lado; E o caminar para levantarse.
- Mobiliario dibujado en código (`src/sprites/furniture.ts`) sobre las dimensiones de cada
  objeto; árboles, plantas y estanque generados con PixelLab (`public/assets/pixel/objects/`).
- Flechas/WASD, Shift para acelerar y clic con búsqueda de rutas por baldosas que respeta paredes y muebles.
- Presencia y movimiento compartidos mediante WebSocket, reconexión y estados.
- Chat de oficina y cercano, con separación entre espacios y zona de reunión.
- Salas de reunión como en la referencia: al pasar el ratón se anuncia la sala y al hacer clic aparece su tarjeta
  (nombre editable, «Iniciar reunión», copiar enlace). Iniciar la reunión lleva al avatar a la silla más cercana
  a la mesa; mientras hay gente dentro las puertas se cierran, y la barra de reunión permite bloquearla (candado rojo
  en cada puerta; nadie más entra hasta que se vacía), copiar el enlace `?meeting=<sala>` que sienta a quien lo abre,
  y abrir el chat de la reunión con sus avisos de entrada y bloqueo. «Volver a mi escritorio» (⌘ D) sale de la sala.
- Decorador con el catálogo de 81 objetos de la referencia en 251 orientaciones (miniaturas, búsqueda, previsualización
  sobre la rejilla, giro con R entre las orientaciones disponibles, selección, arrastre para mover, giro y borrado de lo
  colocado, y también de los objetos originales del mapa, guardados como cambios sobre la base). El servidor valida variante, colisiones y salidas de asientos; persistencia en `server/data/`.
- Perfil, nombre y color de identificación; tema sistema/claro/oscuro y controles flotantes.
- Cliente WebRTC para micrófono, cámara y compartir pantalla, apagados al entrar. Implementado, pero todavía no validado con medios reales de extremo a extremo.

## Verificación

```sh
npm test
npm run build
```

25 pruebas de servidor, asientos, colocación y navegación pasan, incluida la comparación
exacta del modelo de colisión con la referencia y 638 rutas entre asientos. La interfaz de entrada y oficina fue comprobada en navegador. La reconstrucción visual mejora el prototipo inicial, pero sigue sin ser una reproducción exacta: consulta [el informe](docs/COMPARACION-GATHER-2.md).

## Límites actuales

Uso local. No hay autenticación, permisos de edición, invitados seguros, bloqueo de reuniones, historial persistente de chat, canales, mensajes directos, calendario, notificaciones o editor completo de mapas. Todos los participantes locales pueden editar los objetos.

El servidor acepta orígenes locales. Para un despliegue público faltan identidad, autorización, HTTPS, configuración de red y TURN/SFU. No basta con cambiar el host para obtener un despliegue seguro o llamadas entre redes. La conexión P2P se cierra en el cliente cuando deja de cumplirse la proximidad; no es un sistema de reuniones privadas terminado.

El mobiliario y las texturas son dibujos originales de píxel con SVG sin suavizado.
El avatar actual y sus animaciones proceden del personaje existente «Cliente Avatar»
elegido por el usuario en PixelLab. La dracaena también procede de PixelLab. Se sirven desde archivos
locales; no se necesita su API para ejecutar el proyecto. La ropa todavía no es
personalizable. Los iconos son de Lucide (ISC) y se usan fuentes del sistema. No se
han incorporado sprites, código ni credenciales de Gather.

## Estructura

- `src/`: React, mapa, navegación, WebSocket y WebRTC.
- `server/`: servidor Node y protocolo documentado.
- `shared/`: datos del mapa (`vivo-map.js`, generado por `scripts/build-map-data.mjs`), geometría de paredes, colisiones y asientos, usados por servidor y cliente.
- `public/assets/pixel/`: avatar y animaciones locales, con procedencia documentada.
- `tests/`: pruebas de integración y navegación.
- `docs/`: alcance y comparación con el producto original.

Licencia MIT para el código y recursos originales del proyecto. Las dependencias conservan sus propias licencias.
