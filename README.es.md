<div align="center">

[English](README.md) · **Español**

<img src="docs/screenshots/hero-office.png" alt="Open Office For All: una oficina virtual en pixel art con recepción, escritorios de equipo, salas pequeñas y un jardín" width="100%">

# 🌍 Open Office For All

**Una oficina virtual libre y de código abierto para todos los equipos del mundo.**

[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-2ea44f?style=for-the-badge)](LICENSE)
[![Pruebas](https://img.shields.io/badge/pruebas-29%20en%20verde-303fe0?style=for-the-badge)](#-verificación)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-5fa04e?style=for-the-badge&logo=node.js&logoColor=white)](#-inicio-rápido)
[![React 19](https://img.shields.io/badge/react-19-149eca?style=for-the-badge&logo=react&logoColor=white)](#%EF%B8%8F-arquitectura)
[![Autoalojado](https://img.shields.io/badge/tus%20datos-tu%20servidor-f5a623?style=for-the-badge)](#-hecho-para-todo-el-mundo)

[Por qué](#-por-qué-open-office-for-all) · [Inicio rápido](#-inicio-rápido) · [Funciones](#-funciones) · [Arquitectura](#%EF%B8%8F-arquitectura) · [Hoja de ruta](#%EF%B8%8F-hoja-de-ruta)

</div>

---

## ✨ Por qué Open Office For All

Los equipos remotos merecen un lugar donde *estar juntos*, no solo una lista de videollamadas. Open Office For All recrea la sensación de una oficina real en un acogedor mundo de píxeles: acércate a un compañero, siéntate en tu escritorio, entra en una sala de reuniones y cierra la puerta. Sin suscripciones, sin límite de puestos y sin depender de ningún proveedor. **Ejecútalo en tu propio equipo, en cualquier país y en cualquier idioma.**

El proyecto es una recreación fiel e independiente de la experiencia de las oficinas virtuales modernas. Está inspirado en Gather 2.0, no tiene relación con esa empresa y está hecho para que cualquiera pueda estudiarlo, alojarlo y mejorarlo.

---

## 🚀 Inicio rápido

```sh
git clone https://github.com/VictorSandovalDev/OpenOfficeForAll.git
cd OpenOfficeForAll
npm ci
npm run dev
```

Abre **http://127.0.0.1:5173**, escribe tu nombre y entra. Abre una segunda pestaña con otro nombre para ver la presencia, el chat y las reuniones funcionando a la vez. Ambas pestañas comparten la oficina cuando la dirección tiene el mismo valor de `?room=`.

> Necesita Node.js 22.18 o superior (comprobado con la versión 26.8). El servidor de tiempo real escucha en 127.0.0.1:3001.

---

## 🧭 Funciones

<table>
<tr>
<td width="50%" valign="top">

### 🏢 Una oficina de verdad

Un mundo de 52 × 50 baldosas con recepción, escritorios de equipo, cinco salas de reunión, salas pequeñas y un jardín con estanque. Las paredes, las puertas, 203 muebles y 58 asientos están exactamente donde los pondría una oficina real, con el mismo modelo de colisiones.

</td>
<td width="50%" valign="top">

### 🚶 Muévete como si estuvieras allí

Flechas o WASD, Shift para ir más rápido y clic para caminar con rutas que respetan paredes y muebles. Haz clic en una silla o pulsa **E** para sentarte; el brazo de la silla queda delante de ti, como debe ser.

</td>
</tr>
<tr>
<td valign="top">

### 🔒 Salas de reunión que funcionan como tales

Pasa el ratón sobre una sala para ver su nombre y haz clic para abrir su tarjeta. **Iniciar reunión** te lleva a la silla más cercana a la mesa y las puertas se cierran. Si bloqueas la sala aparece un candado rojo en cada puerta y nadie más entra hasta que se vacía. Comparte un enlace (`?meeting=<sala>`) que sienta a los invitados al llegar y cambia el nombre de la sala desde la misma tarjeta.

<img src="docs/screenshots/meeting-locked.png" alt="Una sala de reunión bloqueada con las puertas cerradas y candados rojos" width="100%">

</td>
<td valign="top">

### 🛋️ Decora todo

Un catálogo de **81 objetos en 251 orientaciones**: escritorios, sillas, sofás, plantas, estanterías, lámparas y tecnología. Coloca, arrastra, gira (**R**) y elimina, también los muebles originales. Lo que dejas sobre un escritorio queda encima del escritorio. El modo edición oscurece la oficina y muestra la cuadrícula, y el servidor valida cada colocación para que nadie quede atrapado.

<img src="docs/screenshots/decorator.png" alt="El decorador con su catálogo, la cuadrícula y el aviso de modo edición" width="100%">

</td>
</tr>
<tr>
<td valign="top">

### 💬 Conversa en contexto

Chat para toda la oficina, chat cercano que solo llega a quienes están a tu alrededor y un chat privado de reunión con avisos de entrada, bloqueo y desbloqueo. Las salas de reunión están aisladas; fuera de ellas manda la cercanía.

</td>
<td valign="top">

### 🎥 Audio, vídeo y pantalla compartida

WebRTC entre pares para micrófono, cámara y pantalla compartida, todo apagado al entrar. Las conexiones solo se abren entre personas que pueden escucharse.

</td>
</tr>
</table>

Además: perfil con nombre y color, temas claro, oscuro y del sistema, zoom del 36 % al 400 %, minimapa y atajos de teclado (⌘ / Ctrl K para buscar personas, ⌘ / Ctrl D para volver a tu escritorio).

---

## 🌐 Hecho para todo el mundo

- **Lo alojas tú.** Un solo proceso de Node ejecuta el servidor de tiempo real y el cliente son archivos estáticos. Tu oficina, tus datos, tu servidor.
- **Sin cuentas.** Elige un nombre y un color y entra. Una sala es solo una palabra en la dirección.
- **Abierto a todos los idiomas.** La interfaz está hoy en español y lista para traducirse. Las contribuciones con tu idioma son muy bienvenidas.
- **Abierto a todos los presupuestos.** Licencia MIT. Gratis para una startup de dos personas en Bogotá, un aula en Lagos o un equipo de voluntarios en Manila.
- **Abierto a todos los colaboradores.** Un código pequeño y legible: React y Vite en el cliente, un protocolo WebSocket documentado en el servidor, la geometría compartida en módulos ES sencillos y pruebas que fijan el comportamiento.

---

## 🏗️ Arquitectura

```mermaid
flowchart LR
  subgraph Navegador["Navegador · React 19 + Vite"]
    Escena["Escena de la oficina\nmundo en pixel art,\nrutas, cámara"]
    UI["Interfaz\npaneles, decorador,\nbarra de reunión, chat"]
    RTC["WebRTC\nmicrófono · cámara · pantalla"]
  end
  subgraph Servidor["Node · ws"]
    WS["Servidor de tiempo real\npresencia, asientos, reuniones,\nobjetos, chat"]
    Datos[("server/data\nobjetos colocados,\ncambios, nombres de salas")]
  end
  Compartido["shared/\nmapa, paredes, colisiones,\nasientos, catálogo, reuniones"]
  Escena --> Compartido
  WS --> Compartido
  UI <-- "WebSocket · JSON" --> WS
  RTC <-- "señalización" --> WS
  WS --> Datos
```

| Carpeta | Qué contiene |
| --- | --- |
| `src/` | Cliente React: escena, navegación, decorador, reuniones, chat y WebRTC |
| `server/` | Servidor de tiempo real y la [referencia de su protocolo](server/README.md) |
| `shared/` | Datos del mapa, geometría de paredes y colisiones, asientos, catálogo de objetos y utilidades de reunión que usan ambos lados |
| `public/assets/pixel/` | Animaciones del avatar y arte de píxeles generado, con notas de procedencia |
| `tests/` | Pruebas del servidor, asientos, colocación, reuniones y navegación |
| `docs/` | Notas de diseño y la [comparación detallada con la referencia](docs/COMPARACION-GATHER-2.md) |

---

## ✅ Verificación

```sh
npm test      # 29 pruebas: colisiones, asientos, colocación, reuniones, navegación
npm run build # comprobación de tipos y paquete de producción
```

El modelo de colisiones se compara baldosa por baldosa con el mapa de referencia, las pruebas recorren 638 rutas entre asientos, y el bloqueo de reuniones, el chat de reunión y el cambio de nombre de salas se prueban de extremo a extremo con conexiones WebSocket reales.

---

## 🗺️ Hoja de ruta

- [ ] Vista de reunión a pantalla completa con los participantes en mosaico
- [ ] Canales de chat al estilo de Slack y mensajes directos
- [ ] Calendario y actividad con contenido real
- [ ] Vestuario del avatar con ropa y peinados
- [ ] Traducciones de la interfaz, empezando por el inglés
- [ ] Cuentas, permisos y una guía de despliegue público segura (HTTPS, TURN/SFU)

¿Quieres alguna antes? Abre un issue o envía un pull request.

---

## ⚠️ Límites actuales

Es un proyecto pensado para uso local. Todavía no hay autenticación, permisos de edición ni historial de chat persistente, así que cualquiera en una sala puede decorarla. El servidor solo acepta orígenes locales. Para un despliegue público faltan identidad, autorización, HTTPS, configuración de red y un servicio TURN/SFU para llamadas entre redes distintas.

## 🎨 Arte y créditos

El avatar, los árboles, las plantas y el estanque son arte de píxeles original generado con [PixelLab](https://pixellab.ai) y se sirven desde archivos locales. Los iconos son de [Lucide](https://lucide.dev) (ISC). Los suelos y muebles se transcribieron píxel a píxel de la oficina de referencia para igualar su aspecto y se están sustituyendo por arte original; lee las [notas de comparación](docs/COMPARACION-GATHER-2.md) antes de redistribuirlos. No se incluye código, sprites ni credenciales de ningún producto de terceros.

## 📄 Licencia

[MIT](LICENSE). Úsalo, modifícalo, publícalo y enseña con él.

<div align="center">

**Hecho con ❤️ para todos los equipos, en todas partes.**

</div>
