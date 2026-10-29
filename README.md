<div align="center">

<img src="docs/screenshots/hero-office.png" alt="Open Office For All: a pixel-art virtual office with a lobby, team desks, huddles and a garden" width="100%">

# 🌍 Open Office For All

**A free, open-source virtual office for every team on Earth.**
*Una oficina virtual libre y de código abierto para todos los equipos del mundo.*

[![MIT License](https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-29%20passing-303fe0?style=for-the-badge)](#-verification--verificación)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-5fa04e?style=for-the-badge&logo=node.js&logoColor=white)](#-quick-start--inicio-rápido)
[![React 19](https://img.shields.io/badge/react-19-149eca?style=for-the-badge&logo=react&logoColor=white)](#-architecture--arquitectura)
[![Self-hosted](https://img.shields.io/badge/your%20data-your%20server-f5a623?style=for-the-badge)](#-built-for-the-whole-world--hecho-para-todo-el-mundo)

[English](#-why-open-office-for-all) · [Español](#-por-qué-open-office-for-all) · [Quick start](#-quick-start--inicio-rápido) · [Features](#-features--funciones) · [Roadmap](#%EF%B8%8F-roadmap--hoja-de-ruta)

</div>

---

## ✨ Why Open Office For All

Remote teams deserve a place to *be together*, not just a list of video calls. Open Office For All recreates the feeling of a real office in a cosy pixel-art world: walk over to a colleague, sit down at a desk, step into a meeting room and close the door. No subscriptions, no seat limits, no vendor lock-in. **Run it on your own machine, in any country, in any language.**

The project is a faithful, independent re-creation of the experience of modern virtual-office products (it is inspired by Gather 2.0 and not affiliated with it), built so that anyone can study it, host it and improve it.

## ✨ Por qué Open Office For All

Los equipos remotos merecen un lugar donde *estar juntos*, no solo una lista de videollamadas. Open Office For All recrea la sensación de una oficina real en un mundo de píxeles: acércate a un compañero, siéntate en tu escritorio, entra en una sala de reuniones y cierra la puerta. Sin suscripciones, sin límite de puestos, sin ataduras a un proveedor. **Ejecútalo en tu propio equipo, en cualquier país y en cualquier idioma.**

Es una recreación fiel e independiente de la experiencia de las oficinas virtuales modernas (inspirada en Gather 2.0, sin afiliación), construida para que cualquiera pueda estudiarla, alojarla y mejorarla.

---

## 🚀 Quick start · Inicio rápido

```sh
git clone https://github.com/VictorSandovalDev/OpenOfficeForAll.git
cd OpenOfficeForAll
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**, type your name and walk in. Open a second tab with another name to see presence, chat and meetings working together. Both tabs share the same office when the URL has the same `?room=` value.

Abre **http://127.0.0.1:5173**, escribe tu nombre y entra. Abre una segunda pestaña con otro nombre para ver presencia, chat y reuniones funcionando a la vez. Ambas comparten la oficina cuando la URL tiene el mismo `?room=`.

> Requires Node.js 22.18 or newer (verified with 26.8). The realtime server listens on 127.0.0.1:3001.

---

## 🧭 Features · Funciones

<table>
<tr>
<td width="50%" valign="top">

### 🏢 A real office layout
*Una oficina de verdad*

A 52 × 50 tile world with lobby, team desks, five meeting rooms, huddles, a reception and a garden with a pond. Walls, doorways, 203 pieces of furniture and 58 seats sit exactly where a real office map puts them, with the same collision model.

</td>
<td width="50%" valign="top">

### 🚶 Move like you're there
*Muévete como si estuvieras allí*

Arrow keys or WASD, Shift to hurry, click to walk with path-finding that respects walls and furniture. Click a chair (or press **E**) to sit; the chair's arm draws in front of you, as it should.

</td>
</tr>
<tr>
<td valign="top">

### 🔒 Meeting rooms that behave
*Salas de reunión con sentido*

Hover a room to see its name, click it to open its card. **Start meeting** walks you to the chair nearest the table and the doors close. Lock the room and a red padlock appears on every door: nobody else gets in until it empties. Share a link (`?meeting=<room>`) that seats guests on arrival. Rename rooms in place.

<img src="docs/screenshots/meeting-locked.png" alt="A locked meeting room with closed doors and red padlocks" width="100%">

</td>
<td valign="top">

### 🛋️ Decorate everything
*Decora todo*

A catalogue of **81 objects in 251 orientations**: desks, chairs, sofas, plants, shelves, lamps, tech. Place, drag, rotate (**R**) and delete, including the original furniture. Items dropped on a desk sit on the desk. Edit mode dims the office and shows the grid; the server validates every placement so nobody gets trapped.

<img src="docs/screenshots/decorator.png" alt="The decorator with its catalogue, grid and edit banner" width="100%">

</td>
</tr>
<tr>
<td valign="top">

### 💬 Talk in context
*Conversa en contexto*

Office-wide chat, nearby chat that only reaches people around you, and a private meeting chat with system notices (joined, locked, unlocked). Meeting rooms are acoustically closed; outside them, proximity rules.

</td>
<td valign="top">

### 🎥 Audio, video and screen share
*Audio, vídeo y pantalla*

Peer-to-peer WebRTC for microphone, camera and screen sharing, off by default when you enter. Connections open only between people who can hear each other.

</td>
</tr>
</table>

Also: profiles with name and colour, light / dark / system theme, zoom 36 %–400 %, minimap, keyboard shortcuts (⌘ / Ctrl K to search people, ⌘ / Ctrl D back to your desk) and a settings panel.

---

## 🌐 Built for the whole world · Hecho para todo el mundo

- **Yours to host.** One Node process serves the realtime server; the client is static files. Your office, your data, your server.
- **No accounts required.** Pick a name, pick a colour, walk in. Rooms are just a word in the URL.
- **Open to every language.** The interface ships in Spanish today; every string lives in the React components and is ready to be translated. Pull requests for your language are very welcome.
- **Open to every budget.** MIT licensed. Free for a two-person startup in Bogotá, a classroom in Lagos or a volunteer team in Manila.
- **Open to every contributor.** A small, readable codebase: React + Vite on the client, a documented WebSocket protocol on the server, shared geometry in plain ES modules, and tests that pin the behaviour down.

---

## 🏗️ Architecture · Arquitectura

```mermaid
flowchart LR
  subgraph Browser["Browser · React 19 + Vite"]
    Scene["VivoScene\nSVG pixel-art world,\npath-finding, camera"]
    UI["App shell\npanels, decorator,\nmeeting bar, chat"]
    RTC["WebRTC\nmic · camera · screen"]
  end
  subgraph Server["Node · ws"]
    WS["Realtime server\npresence, seats, meetings,\nobjects, chat"]
    Data[("server/data\nplaced objects,\noverrides, room names")]
  end
  Shared["shared/\nmap, walls, collisions,\nseats, catalogue, meetings"]
  Scene --> Shared
  WS --> Shared
  UI <-- "WebSocket · JSON" --> WS
  RTC <-- "signalling" --> WS
  WS --> Data
```

| Folder | What lives there |
| --- | --- |
| `src/` | React client: scene, navigation, decorator, meetings, chat, WebRTC |
| `server/` | Realtime server and its [protocol reference](server/README.md) |
| `shared/` | Map data, wall and collision geometry, seats, object catalogue and meeting helpers used by both sides |
| `public/assets/pixel/` | Avatar animations and generated pixel art, with provenance notes |
| `tests/` | Server, seating, placement, meeting and navigation tests |
| `docs/` | Design notes and the detailed [comparison with the reference](docs/COMPARACION-GATHER-2.md) |

---

## ✅ Verification · Verificación

```sh
npm test      # 29 tests: collisions, seats, placement, meetings, navigation
npm run build # type-check + production bundle
```

The collision model is compared tile by tile with the reference map, 638 routes between seats are walked in the tests, and the meeting lock, meeting chat and room renaming are exercised end to end over real WebSocket connections.

---

## 🗺️ Roadmap · Hoja de ruta

- [ ] Full-screen meeting view with participant tiles
- [ ] Slack-style chat channels and direct messages
- [ ] Calendar and activity feed with real content
- [ ] Avatar wardrobe (clothing and hair)
- [ ] Interface translations (English first, then yours)
- [ ] Accounts, permissions and a hardened public deployment guide (HTTPS, TURN/SFU)

Want one of these sooner? Open an issue or send a pull request.

---

## ⚠️ Current limits · Límites actuales

This is a local-first project. There is no authentication, no edit permissions and no persistent chat history yet; everyone in a room can decorate it. The server accepts local origins only: a public deployment still needs identity, authorisation, HTTPS, network configuration and a TURN/SFU service for calls across networks.

## 🎨 Art and credits · Arte y créditos

The avatar, trees, plants and pond are original pixel art generated with [PixelLab](https://pixellab.ai) and served from local files. Icons are [Lucide](https://lucide.dev) (ISC). The floors and furniture were transcribed pixel by pixel from the reference office while matching its look, and are being replaced with original artwork; see the [comparison notes](docs/COMPARACION-GATHER-2.md) before redistributing them. No code, sprites or credentials from any third-party product are included.

## 📄 License · Licencia

[MIT](LICENSE). Use it, fork it, ship it, teach with it.

<div align="center">

**Made with ❤️ for every team, everywhere.**
*Hecho con ❤️ para todos los equipos, en todas partes.*

</div>
