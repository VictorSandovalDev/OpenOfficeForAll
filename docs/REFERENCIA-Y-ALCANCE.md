# Oficina virtual de código abierto: referencia y alcance

Fecha de investigación: 26 de octubre de 2026.

## Objetivo

Construir una implementación propia de una oficina virtual que reproduzca con alta fidelidad los flujos, la interacción y la presentación de la versión de Gather elegida por el usuario. El proyecto debe poder ejecutarse localmente y prepararse para su publicación como software de código abierto.

Estado: prototipo local implementado. El usuario eligió Gather 2.0 y se inspeccionó directamente su aplicación de escritorio. La comparación y las diferencias pendientes están en [COMPARACION-GATHER-2.md](COMPARACION-GATHER-2.md). Hay presencia, movimiento, chat y objetos compartidos; aún no hay paridad visual ni funcional completa.

## Decisiones pendientes

- Referencia confirmada: Gather 2.0, espacio Vivo.
- Espacio de referencia accesible desde la aplicación de escritorio; completar inspección de edición y pruebas de dos sesiones.
- Capturar la versión y fecha de referencia: Gather sigue cambiando y una equivalencia debe evaluarse contra un estado concreto.
- Nombre provisional: Open Office. Código propio bajo MIT; falta preparar la publicación del repositorio.

## Material de referencia

No es necesario descargar la aplicación para comenzar la investigación. Podemos comenzar desde la web y usar el cliente de escritorio cuando una función específica lo requiera. Descargar el cliente no proporciona el código fuente del producto ni su servidor.

El usuario inicia sesión directamente. No se necesitan contraseñas ni tokens en archivos del proyecto.

Para comprobar los flujos compartidos hacen falta dos sesiones. Los ensayos deben realizarse en un espacio de prueba; la edición requiere permisos sobre ese espacio.

## Matriz de observación y aceptación

La siguiente matriz es un plan de verificación, no una declaración de funciones implementadas ni de paridad alcanzada.

| Área | Qué observar en la referencia | Qué verificar en nuestra implementación |
| --- | --- | --- |
| Entrada | Selección de espacio, nombre, avatar y dispositivos | Entrada reproducible, permisos concedidos/denegados y errores comprensibles |
| Oficina | Distribución, capas, escala, tipografía, paneles y zoom | Comparaciones visuales a resolución y zoom equivalentes |
| Movimiento | Teclado, ratón, velocidad, colisiones y puertas | Dos sesiones ven el mismo movimiento y no atraviesan obstáculos |
| Presencia | Llegada, salida, estados y reconexión | No quedan participantes fantasma; los estados se sincronizan |
| Conversaciones | Distancia de conexión, desconexión, grupos y transiciones | Dos sesiones pueden entrar y salir de una conversación siguiendo las reglas observadas |
| Privacidad | Áreas privadas, bloqueo e invitados | Quienes están fuera no reciben audio, vídeo ni mensajes restringidos |
| Audio y vídeo | Silenciar, cámara, selección de dispositivos y fallos | Medios reales entre sesiones y recuperación de errores |
| Compartir pantalla | Inicio, selección, finalización y vistas | La otra sesión recibe el contenido y su finalización se refleja correctamente |
| Chat | Destinatarios, historial, notificaciones y formatos | Entrega al destinatario correcto y persistencia según el alcance elegido |
| Avatar | Opciones, movimiento, orientación y animaciones | Cambios visibles en las demás sesiones; recursos redistribuibles |
| Objetos | Activación, colisiones, contenido y comportamiento | Interacciones funcionales, no controles decorativos |
| Editor | Colocar, mover, eliminar, guardar y permisos | Persistencia del mapa y edición limitada a quienes corresponda |
| Administración | Miembros, invitaciones, roles y acceso | Aislamiento entre espacios y permisos comprobados en servidor |
| Instalación | Servicios y configuración necesarios | Otra persona puede iniciar el proyecto siguiendo la documentación |

## Diferencias que requieren elegir versión

Classic utiliza Mapmaker/Build Tool y tiene flujos de movimiento e interacción propios. Gather 2.0 cambia el estilo visual, las vistas, el editor Studio y los flujos de presencia y colaboración. Las capacidades exactas se comprobarán en la versión elegida.

La documentación pública sirve para descubrir funciones, pero no permite inferir todos los tamaños, tiempos, estados y reglas de interacción. La fidelidad se verificará contra observaciones reales y se registrarán las diferencias conocidas.

## Secuencia de implementación

1. Registrar las pantallas y flujos de la referencia elegida, con datos de prueba.
2. Implementar oficina, avatar, controles y movimiento; comprobar presentación e interacción.
3. Añadir presencia y movimiento compartidos entre dos sesiones.
4. Implementar audio/vídeo, proximidad, salas y pantalla compartida; comprobar privacidad.
5. Añadir chat, objetos, personalización, editor y persistencia.
6. Completar administración y las funciones adicionales de la versión elegida.
7. Probar instalación independiente, reconexión, permisos y concurrencia; documentar límites.
8. Preparar licencia, atribuciones de dependencias/recursos y publicación del repositorio.

El código y los recursos publicados deben ser propios o tener una licencia que permita su redistribución. Las capturas de referencia no se incorporarán como recursos de la aplicación.

## Entorno comprobado

- Node.js 26.8.1.
- npm 11.19.0.
- Git 2.50.1.
- pnpm y Bun disponibles.
- Control del navegador integrado disponible.

No hace falta adquirir herramientas para la fase inicial. La arquitectura y los servicios de tiempo real se seleccionarán después de fijar el alcance; no se ha contratado ni desplegado infraestructura.

## Fuentes oficiales

- [Comparación de Gather 1.0 y 2.0](https://support.gather.town/articles/2163640255-gather-1-0-vs-gather-2-0).
- [Qué es Gather Classic](https://support.gather.town/articles/7937173755-what-is-gather).
- [Funciones de Classic](https://support.gather.town/articles/3950877146-overview-of-gather-1-0-features).
- [Reuniones en Classic](https://support.gather.town/articles/4892470515-overview-of-meetings-for-remote-office-spaces).
- [Inicio en Gather 2.0](https://support.help.gather.town/articles/1982412443-getting-started-guide).
- [Novedades oficiales](https://www.gather.town/whats-new).

Las páginas comparativas pueden quedarse atrás respecto del registro de novedades. Verificar funciones actuales en el producto antes de declararlas ausentes.
