# Local realtime server

Run `node server/index.mjs` after installing the project's dependencies. The default
address is `127.0.0.1:3001`; `PORT` and `HOST` override it. `GET /health` reports
whether the server is alive. Browser WebSocket clients must come from a localhost
origin and connect to `/ws?room=<slug>`. Slugs accept lowercase letters, numbers,
hyphens, and underscores (1–64 characters).

Send `{ "type": "join", "name": "Ana", "color": "#7968e6" }` first. A `welcome`
message supplies the server-generated participant ID, current participants,
office chat history, and placed objects. All room members receive `participants`
when someone joins, moves, changes their profile, or disconnects.

Supported messages:

- `move`: numeric `x` and `y`, clamped to the 1600 × 1100 map. The server derives
  `facing` (`north`, `east`, `south`, `west`) from movement. A valid optional
  `facing` also permits turning while stationary. Seated participants must stand
  first; movement while seated returns `seat_unavailable`.
- `seat:sit`: `seatId` from `shared/office-seats.js`. The server validates the
  chair, a distance of at most 64 map units, a non-away status, a free exit,
  an unobstructed walking segment to that exit, and exclusive occupancy within
  the room. Proximity through a wall does not allow sitting. It sets the participant's `seatId`,
  chair position and facing, then broadcasts `participants`. Invalid requests
  return `invalid_seat`, `seat_too_far` or `seat_unavailable`. Repeating a request
  for the participant's current seat is safe. A participant must stand before
  switching chairs.
- `seat:stand`: clears `seatId`, moves to the chair's shared walking exit and
  broadcasts `participants`. Client-supplied coordinates are ignored. Sending
  it while already standing is safe. There are 30 fixed chairs; placed chairs
  receive IDs of the form `object:<object-id>`. Deleting an occupied chair also
  stands its occupant. Disconnecting releases occupancy. Seat assignments are
  transient and are not saved to disk.
- `profile`: optional `name`, hex `color`, `status` (`available`, `busy`, `away`,
  `focus`), and boolean `mic`, `camera`, `screen`.
- `meeting:lock`: `areaId` of a meeting room and `locked`. Only someone inside the room may change it;
  a locked room rejects `move` and `seat:sit` from outside with `meeting_locked`, and unlocks when it empties.
  Meeting state travels with every `participants` message as `meetings` (`{ [areaId]: { active, locked, participants, startedAt, music?, recordingBy? } }`).
- `object:add` and `object:update` accept `free: true` to keep the exact position instead of the grid; the object is
  drawn at that point and still blocks the tiles it stands on. Moving without `free` returns it to the grid.
- Workspaces: `POST /api/workspaces` with `name` (2–60 characters), `template` (`office` or `empty`) and, when
  the server has an invite key, `key`; replies `201 { slug, name }` with a unique address made from the name.
  `GET /api/workspaces/<slug>` returns its name. Every workspace is its own room (map, chat, calendar, desks);
  `empty` starts with every piece of furniture removed. `welcome` carries `workspace`; editors send
  `workspace:rename` with `name`, and everyone receives `workspace`. Saved in `server/data/workspaces.json`.
- Closed focus offices: while someone is inside, moving or sitting there from outside fails with `focus_closed`
  (and its `areaId`). Outsiders send `focus:knock` with `areaId`; people inside receive `focus:knock` with `from`.
  Inside, `focus:admit` (`areaId`, `participantId`) lets one person in (they receive `focus:admitted`) and
  `focus:door` (`areaId`, `open`) opens or closes the door for everyone. `participants` carries `focusRooms`.
- Focus offices: the four private offices along the top. Someone who enters one alone while `available` is
  switched to `focus` (Do not disturb, so proximity calls do not connect) and gets `focusZone`; leaving restores
  the previous status. Choosing a status by hand inside the office is respected until they leave.
- `desk:assign`: `areaId` of a desk and `userId` (someone from the office) or `null` to free it. Anyone may claim a
  free desk or free their own; assigning or freeing other people's desks needs edit rights. One desk per person.
  Saved in `server/data/<room>.desks.json`; `welcome` and every change carry `desks` (`{ [areaId]: userId }`).
- `meeting:music`: `playing` (boolean). Starts or stops the shared background music of the sender's meeting room;
  `music` is `{ startedAt, by }`, and every client plays the same generated bars from `startedAt`. It ends with the meeting.
- `meeting:record`: `recording` (boolean). One person per room may record; the room sees `recordingBy` and a system
  message in the meeting chat. The recording stops when that person leaves. Audio is mixed and saved in their browser only.
- `media:token`: only inside a meeting room and only when the server has `LIVEKIT_URL`, `LIVEKIT_API_KEY` and
  `LIVEKIT_API_SECRET`. Replies `media:token` with `url`, `room` (`<office>--<areaId>`), `areaId` and a signed
  LiveKit access token (6 hours, join, publish and subscribe for that room only). Otherwise `sfu_unavailable`.
  `/config` reports `sfu: true` when a media server is configured.
- `area:rename`: `areaId` of a meeting room and `name` (1–40 characters); persisted and broadcast as `areas`.
- `join` may include `userId` (8–64 characters `[A-Za-z0-9_-]`), a stable identity per browser and name used for
  direct messages and the people directory; without it the session id is used. `welcome` returns `userId`,
  `channels`, `users` (directory) and `messages` (every channel's history plus the direct messages that include you).
- `profile` also accepts `avatar` (`{ body, skin, hair, top, bottom, shoes, glasses, hat, beard }`, palette indices validated
  against `src/avatarLook.ts`) and `statusText` (up to 60 characters; empty clears it). `join` accepts `avatar` too.
- `chat`: `text` (1–4000 characters) and `channel`:
  - `channel` with `channelId` (`office` is accepted as an alias of `#general`): reaches everyone and is persisted
    in `server/data/<room>.chat.json` (last 200 per channel).
  - `dm` with `to` (a `userId` from the directory): reaches only both people and is persisted under `dmKey`.
  - `nearby`: proximity only, never stored. `meeting`: only people inside the same meeting room, never stored.
- `channel:create`: `name` and optional `topic` (160 characters). The visible name keeps accents (`diseño`) and the
  id is its ASCII slug (`diseno`); every office starts with `#general` and `#social`. Broadcast as `channels`.
- `channel:update`: `channelId` and `topic`.
- `event:create`: `title` (120), `start` and `end` (ISO dates, end after start, at most one day), optional
  `areaId` (a meeting room) and `description`. Stored in `server/data/<room>.calendar.json` and broadcast as
  `events`; `welcome` includes `events`.
- `event:delete`: `id`. Only the organizer (same `userId`) may cancel.
- `object:add`: `kind` (a catalog kind from `shared/vivo-catalog.js`, or the aliases
  `plant`, `chair`, `table`, `lamp`), optional `color` and `facing` (`Up`, `Right`, `Down`,
  `Left`), `x`, `y` (snapped to the tile that contains the point). Placements
  overlapping the feet of a standing participant, including the editor, or
  blocking every exit beside an occupied chair return `invalid_object`. The
  standing check uses the same object footprint and avatar radius as walking;
  it only checks the newly placed object, not unrelated static geometry.
- `object:update` with `reset: true` on a map object removes its override and returns it to the exact reference placement (used by undo).
- `object:update`: object `id` plus `rotate: true` (next available facing), an explicit `facing`,
  or new `x`/`y`. Occupied chairs cannot be edited. Validated like `object:add`. The `id` may
  also name a base-map object (`shared/vivo-map.js`): the change is stored as an override.
- `object:remove`: object `id`, placed or base-map (stored as a `removed` override).
  Edits return `objects` with the current array and the `overrides` map; `welcome` carries both.
- `signal`: `to` participant ID and `data` object. Relayed with the sender's
  authoritative `from` ID only when both participants have `available` status
  and share a conversation area: within 220 map units outside the meeting area,
  or anywhere inside the meeting area (`x > 1080 && y > 760`). Signals never cross
  the meeting area's boundary, even if participants stand close together.

Objects are saved atomically in `server/data/<room>.json`. Names, messages, media,
and participant sessions are not written to disk. A restart clears chat history.
Invalid messages return `{type: "error", code, message}`. Payload size, room
capacity, room count, outbound buffering, and message rates are bounded.

This is a **local development prototype**. It has no accounts, authentication,
room authorization, editor roles, moderation, TLS, TURN relay, or SFU. Anyone
allowed to connect to a local room can choose their name, move, and edit its
objects. IDs prevent accidental identity spoofing within the protocol; they are
not proof of identity. Do not expose this server to the internet as-is. Signaling
relays peer connection metadata; clients must tear down media peer connections
when participants leave the conversation area or disconnect. Browser permissions
still govern camera, microphone, and screen capture.

For tests, `await startServer({port: 0, dataDir})` returns
`{server, wss, host, port, close}`. Always `await instance.close()` for shutdown.
