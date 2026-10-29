<div align="center">

**English** · [Español](README.es.md)

<img src="docs/screenshots/hero-office.png" alt="Open Office For All: a pixel-art virtual office with a lobby, team desks, huddles and a garden" width="100%">

# 🌍 Open Office For All

**A free, open-source virtual office for every team on Earth.**

[![MIT License](https://img.shields.io/badge/license-MIT-2ea44f?style=for-the-badge)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/VictorSandovalDev/OpenOfficeForAll/ci.yml?branch=main&style=for-the-badge&label=tests)](https://github.com/VictorSandovalDev/OpenOfficeForAll/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-5fa04e?style=for-the-badge&logo=node.js&logoColor=white)](#-quick-start)
[![React 19](https://img.shields.io/badge/react-19-149eca?style=for-the-badge&logo=react&logoColor=white)](#-architecture)
[![Self-hosted](https://img.shields.io/badge/your%20data-your%20server-f5a623?style=for-the-badge)](#-built-for-the-whole-world)

[Why](#-why-open-office-for-all) · [Quick start](#-quick-start) · [Features](#-features) · [Architecture](#-architecture) · [Roadmap](#%EF%B8%8F-roadmap)

</div>

---

## ✨ Why Open Office For All

Remote teams deserve a place to *be together*, not just a list of video calls. Open Office For All recreates the feeling of a real office in a cosy pixel-art world: walk over to a colleague, sit down at a desk, step into a meeting room and close the door. No subscriptions, no seat limits, no vendor lock-in. **Run it on your own machine, in any country, in any language.**

The project is a faithful, independent re-creation of the experience of modern virtual-office products. It is inspired by Gather 2.0 and not affiliated with it, and it is built so that anyone can study it, host it and improve it.

---

## 🚀 Quick start

```sh
git clone https://github.com/VictorSandovalDev/OpenOfficeForAll.git
cd OpenOfficeForAll
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**, type your name and walk in. Open a second tab with another name to see presence, chat and meetings working together. Both tabs share the same office when the URL has the same `?room=` value.

> Requires Node.js 22.18 or newer (verified with 26.8). The realtime server listens on 127.0.0.1:3001.

**Put it online for your team:** the [deployment guide](docs/DEPLOY.md) sets up HTTPS, an invite key, admin-only decorating and a TURN relay with one `docker compose up`.

---

## 🧭 Features

<table>
<tr>
<td width="50%" valign="top">

### 🏢 A real office layout

A 52 × 50 tile world with a lobby, team desks, five meeting rooms, huddles, a reception and a garden with a pond. Walls, doorways, 203 pieces of furniture and 58 seats sit exactly where a real office map puts them, with the same collision model.

</td>
<td width="50%" valign="top">

### 🚶 Move like you're there

Arrow keys or WASD, Shift to hurry, click to walk with path-finding that respects walls and furniture. Click a chair or press **E** to sit; the chair's arm draws in front of you, and walls hide you when you walk behind them.

</td>
</tr>
<tr>
<td valign="top">

### 🔒 Meeting rooms that behave

Hover a room to see its name and click it to open its card. **Start meeting** walks you to the chair nearest the table and the doors close. Lock the room and a red padlock appears on every door. Share a link (`?meeting=<room>`) that seats guests on arrival, and rename rooms in place.

<img src="docs/screenshots/meeting-locked.png" alt="A locked meeting room with closed doors and red padlocks" width="100%">

</td>
<td valign="top">

### 🎬 A full meeting view

Switch between the office and a full-screen meeting view: participant tiles with cameras or initials, and side panels for the meeting chat, the people in the room and the meeting details.

<img src="docs/screenshots/meeting-view-en.png" alt="The meeting view with two participant tiles and the meeting chat" width="100%">

</td>
</tr>
<tr>
<td valign="top">

### 💬 Channels and direct messages

Slack-style chat: `#general`, `#social` and any channel you create, private direct messages, @mentions, formatting (bold, italic, lists, code, links), drafts and unread badges. History is kept on your server. Nearby chat still reaches only the people around you.

<img src="docs/screenshots/chat-channels-en.png" alt="The general channel with formatted messages, the channel list and the office in a corner" width="100%">

</td>
<td valign="top">

### 📅 Calendar and activity

A week calendar shared by the whole office. Schedule a meeting in a room and everyone sees it; **Join** seats you in that room. The activity feed collects mentions, direct messages and meetings that are about to start.

<img src="docs/screenshots/calendar-en.png" alt="The week calendar with a scheduled meeting and its details" width="100%">

</td>
</tr>
<tr>
<td valign="top">

### 🛋️ Decorate everything

A catalogue of **81 objects in 251 orientations**: desks, chairs, sofas, plants, shelves, lamps and tech. Place, drag, rotate (**R**), delete and undo (**⌘ Z**), including the original furniture. Items dropped on a desk sit on the desk, and the server validates every placement so nobody gets trapped.

<img src="docs/screenshots/decorator.png" alt="The decorator with its catalogue, grid and edit banner" width="100%">

</td>
<td valign="top">

### 🧑‍🎨 Make the avatar yours

Pick a male or female body, then skin, hair, top, bottom and shoe colours, glasses, hats, headphones and facial hair. The pixel art keeps its own shading in every pose and walking frame, and everyone sees your look. Set your status (Active, Busy, Away) and a short status message.

<img src="docs/screenshots/avatar-editor-en.png" alt="The avatar editor with categories, options and a live preview" width="100%">

</td>
</tr>
<tr>
<td valign="top" colspan="2">

### 🎵 Meetings for the whole team

Plug in an optional [LiveKit](https://livekit.io) media server and meeting rooms switch to it: each person sends their camera once, so a meeting of twenty is as smooth as a meeting of two. Proximity chats stay peer to peer. Inside a room, anyone can start **calm background music for everyone** (generated in the browser, in sync for all), **record the meeting audio** to a file with a visible *Recording* badge for the whole room, raise a hand, send emoji reactions, or pop the call out into a small always-on-top window while working elsewhere.

<img src="docs/screenshots/meeting-large-en.png" alt="A meeting with five cameras, music on, a recording badge and a raised hand" width="100%">

</td>
</tr>
</table>

Also included: audio, video and screen sharing over WebRTC (all off when you enter), optional personal accounts with passwords, interactive objects that open a link or a note when you press **X** next to them, workspaces with their own name and map (start from the full office or an empty one), assigned desks (⌘ / Ctrl D takes you to yours), focus offices that switch you to Do not disturb and close their door while you are inside (others knock and you let them in), scroll-wheel zoom with an overview of everyone when you zoom far out, profiles, light, dark and system themes, English and Spanish, zoom from 36 % to 400 %, a minimap, and keyboard shortcuts (⌘ / Ctrl K to search people, ⌘ / Ctrl D to return to your desk).

---

## 🌐 Built for the whole world

- **Yours to host.** One Node process runs the realtime server and the client is static files. Your office, your data, your server.
- **No accounts required.** Pick a name, pick a colour, walk in. A room is just a word in the URL. Turn on personal accounts when your team wants them.
- **Open to every language.** The interface ships in English and Spanish, follows the browser's language and can be switched in Settings. Adding a language is one dictionary file in `src/i18n/`; pull requests for yours are very welcome.
- **Open to every budget.** MIT licensed. Free for a two-person startup in Bogotá, a classroom in Lagos or a volunteer team in Manila.
- **Open to every contributor.** A small, readable codebase: React and Vite on the client, a documented WebSocket protocol on the server, shared geometry in plain ES modules, and tests that pin the behaviour down.

---

## 🏗️ Architecture

```mermaid
flowchart LR
  subgraph Browser["Browser · React 19 + Vite"]
    Scene["Office scene\npixel-art world,\npath-finding, camera"]
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
| `src/` | React client: scene, navigation, decorator, meetings, chat and WebRTC |
| `server/` | Realtime server and its [protocol reference](server/README.md) |
| `shared/` | Map data, wall and collision geometry, seats, object catalogue and meeting helpers used by both sides |
| `public/assets/pixel/` | Avatar animations and generated pixel art, with provenance notes |
| `tests/` | Server, seating, placement, meeting and navigation tests |
| `docs/` | Design notes and the detailed [comparison with the reference](docs/COMPARACION-GATHER-2.md) |

---

## ✅ Verification

```sh
npm test      # 47 tests: collisions, seats, placement, meetings, chat, accounts, media tokens
npm run build # type-check and production bundle
```

The collision model is compared tile by tile with the reference map, the tests walk 638 routes between seats, and the meeting lock, meeting chat and room renaming are exercised end to end over real WebSocket connections.

---

## 🗺️ Roadmap

- [x] Full-screen meeting view with participant tiles
- [x] Slack-style chat channels and direct messages
- [x] Calendar and activity feed
- [x] Avatar editor: skin, hair, clothes and shoes colours, glasses and hats
- [x] Female body, facial hair and headphones
- [ ] More hairstyles and outfits
- [x] Interface in English and Spanish
- [ ] More interface languages
- [x] Public deployment: HTTPS, invite key, admin role, TURN relay, Docker
- [x] Personal accounts with passwords
- [ ] Single sign-on
- [x] Media server (LiveKit) for large meetings
- [x] Music for everyone, meeting recording and pop-out window

Want one of these sooner? Open an issue or send a pull request.

---

## ⚠️ Current limits

Personal accounts are optional (`ACCOUNTS=optional` or `required`); without them identities are the names people choose, protected by the invite and admin keys. Single sign-on is not available yet. Without a media server, calls are peer to peer, which works well for groups of up to about eight people with cameras on. Recording captures audio only, in the browser of the person who starts it.

## 🎨 Art and credits

The avatar, trees, plants and pond are original pixel art generated with [PixelLab](https://pixellab.ai) and served from local files. Icons are [Lucide](https://lucide.dev) (ISC). By default the floors and furniture are a pixel-by-pixel transcription of the reference office, so the look matches it exactly; do not redistribute that art. **Settings → Map art → Original** switches to the project's own art (PixelLab-generated furniture and code-drawn floors), which is free to redistribute; see the [comparison notes](docs/COMPARACION-GATHER-2.md). No code, sprites or credentials from any third-party product are included.

## 📄 License

[MIT](LICENSE). Use it, fork it, ship it, teach with it.

<div align="center">

**Made with ❤️ for every team, everywhere.**

</div>
