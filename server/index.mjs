import http from 'node:http';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { OFFICE_SIZE as MAP, MEDIA_RADIUS, CHAT_RADIUS, SPAWN, sharesConversationArea } from '../shared/office-world.js';
import { canApproachSeat, canExitSeat, getOfficeSeat, getOfficeSeats, SEAT_INTERACTION_RADIUS } from '../shared/office-seats.js';
import { BASE_OBJECTS, baseAsEditorObject, catalogEntry, isBaseObjectId, nextFacing, officeObjectBlocksPoint, validOverride } from '../shared/office-objects.js';
import { FOCUS_ROOMS, focusRoomOf, meetingRoom, meetingRoomOf } from '../shared/office-meetings.js';
import { createAccounts } from './accounts.mjs';
import { AREAS } from '../shared/vivo-map.js';

/** Desk areas of the office; each can belong to one person. */
const DESK_IDS = new Set(AREAS.filter((area) => area.type === 'Desk').map((area) => area.id));

const OBJECT_KIND = /^[a-z0-9-]{1,64}$/;
const OBJECT_COLOR = /^[a-z]{1,24}$/;
const OBJECT_FACINGS = new Set(['Up', 'Right', 'Down', 'Left']);
const validObject = (object) => OBJECT_KIND.test(object.kind) && (object.color === undefined || OBJECT_COLOR.test(object.color)) && (object.facing === undefined || OBJECT_FACINGS.has(object.facing)) && !!catalogEntry(object);
const STATUSES = new Set(['available', 'busy', 'away', 'focus']);
const FACINGS = new Set(['north', 'east', 'south', 'west']);
const ROOM_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const MAX_OBJECTS = 250;
const MAX_HISTORY = 200;
const MAX_CHANNELS = 40;
const MAX_EVENTS = 300;
const REACTIONS = new Set(['👍', '❤️', '😂', '🎉', '👏', '😮', '🙌', '🔥']);
/** Avatar looks: one palette index per zone plus accessories (sizes match src/avatarLook.ts). */
const LOOK_SIZES = { body: 2, skin: 5, hair: 9, top: 11, bottom: 8, shoes: 6, glasses: 4, hat: 4, beard: 4 };
const sanitizeLook = (value) => {
  if (!value || typeof value !== 'object') return undefined;
  const look = {};
  for (const [key, size] of Object.entries(LOOK_SIZES)) { const n = Number(value[key]); look[key] = Number.isInteger(n) && n >= 0 && n < size ? n : (key === 'skin' || key === 'hair' ? 1 : 0); }
  return look;
};
/** What happens when someone presses X next to an object: an embedded website or a note. */
const cleanInteraction = (value) => {
  if (!value || typeof value !== 'object') return null;
  const title = cleanText(value.title, 80);
  if (value.type === 'link') {
    try { const url = new URL(String(value.url)); if (!['https:', 'http:'].includes(url.protocol)) return null; return { type: 'link', url: url.href.slice(0, 2000), ...(title ? { title } : {}) }; } catch { return null; }
  }
  if (value.type === 'note') { const text = cleanText(value.text, 4000); return text ? { type: 'note', text, ...(title ? { title } : {}) } : null; }
  return null;
};
const isoTime = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const USER_ID = /^[A-Za-z0-9_-]{8,64}$/;
/** Company channels every office starts with, as in the reference. */
const DEFAULT_CHANNELS = [
  { id: 'general', name: 'general', topic: '📣 Comparte novedades, logros y anuncios de toda la empresa' },
  { id: 'social', name: 'social', topic: '🎉 Conversaciones informales, celebraciones y lo que no es de trabajo' },
];
const channelSlug = (value) => typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) : '';
/** The visible channel name keeps accents and ñ (lowercase, spaces as dashes); the id is its ASCII slug. */
const channelName = (value) => typeof value === 'string' ? value.toLowerCase().trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) : '';
const dmKey = (a, b) => `dm:${[a, b].sort().join(':')}`;
const cleanText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : '';

function position(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(0, Math.min(MAP.width, x)), y: Math.max(0, Math.min(MAP.height, y)) };
}

function displayName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '';
}

export function canConnect(a, b) {
  return a.status === 'available' && b.status === 'available' && sharesConversationArea(a, b, MEDIA_RADIUS);
}

function takeToken(bucket, capacity, perSecond) {
  const now = Date.now();
  bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.at) / 1000) * perSecond);
  bucket.at = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Browsers must connect from this server's own host, a local development host, or an origin listed in ALLOWED_ORIGINS. */
function validOrigin(origin, host, allowedOrigins = []) {
  if (!origin) return true; // CLI and test clients have no Origin header.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return true;
    if (host && parsed.host === host) return true;
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}
/** A LiveKit access token (JWT, HS256) for one meeting room; the API secret never leaves the server. */
function livekitToken({ key, secret, identity, name, room, ttlSeconds = 6 * 3600 }) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iss: key, sub: identity, name, nbf: now - 10, exp: now + ttlSeconds, video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false } })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
const sameSecret = (given, expected) => {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};
function parseIceServers(value) {
  if (!value) return [];
  try {
    const servers = JSON.parse(value);
    return Array.isArray(servers) ? servers.filter((server) => server && (typeof server.urls === 'string' || (Array.isArray(server.urls) && server.urls.every((url) => typeof url === 'string')))).slice(0, 8) : [];
  } catch { console.warn('ICE_SERVERS is not valid JSON; calls will only work on local networks.'); return []; }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

/** A local development server. Identities are session IDs, not authenticated accounts. */
export async function startServer({
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1',
  dataDir = resolve(dirname(fileURLToPath(import.meta.url)), 'data'),
  maxRooms = 50,
  maxParticipants = 32,
  // Public deployments: a shared invite key to enter, an admin key to decorate and rename, extra browser origins,
  // runtime STUN/TURN servers, and the built client served from this same process.
  accessKey = process.env.OFFICE_ACCESS_KEY || '',
  adminKey = process.env.OFFICE_ADMIN_KEY || '',
  editPolicy = process.env.EDIT_POLICY === 'admins' || process.env.EDIT_POLICY === 'everyone' ? process.env.EDIT_POLICY : undefined,
  allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  iceServers = parseIceServers(process.env.ICE_SERVERS),
  staticDir = process.env.SERVE_CLIENT === 'false' ? null : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
  // Personal accounts: 'off' (names only), 'optional' (guests or accounts) or 'required'.
  accounts: accountMode = ['optional', 'required'].includes(process.env.ACCOUNTS) ? process.env.ACCOUNTS : 'off',
  // Media server for meeting rooms (LiveKit). Without it, calls are peer to peer everywhere.
  // New workspaces are furnished as a copy of this office's current design (Vivo by default).
  templateRoom = ROOM_SLUG.test(process.env.WORKSPACE_TEMPLATE ?? '') ? process.env.WORKSPACE_TEMPLATE : 'mi-oficina',
  livekit = process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET } : null,
} = {}) {
  const accounts = accountMode === 'off' ? null : createAccounts(dataDir);
  const loginRate = new Map();
  const workspaceRate = new Map();

  // --- Workspaces: each one is a room with its own map, chat, calendar and desks, and a display name. ---
  const workspaceStore = { list: null, write: Promise.resolve() };
  async function loadWorkspaces() {
    if (workspaceStore.list) return workspaceStore.list;
    try { const saved = JSON.parse(await readFile(join(dataDir, 'workspaces.json'), 'utf8')); workspaceStore.list = saved?.workspaces && typeof saved.workspaces === 'object' ? saved.workspaces : {}; }
    catch { workspaceStore.list = {}; }
    return workspaceStore.list;
  }
  function saveWorkspaces() {
    const snapshot = JSON.stringify({ version: 1, workspaces: workspaceStore.list });
    workspaceStore.write = workspaceStore.write.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const destination = join(dataDir, 'workspaces.json'), temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 }); await rename(temporary, destination);
    }).catch((cause) => console.error(`Could not save workspaces: ${cause.message}`));
    return workspaceStore.write;
  }
  // Rooms that existed before workspaces keep a readable name; the original office is "Vivo".
  const defaultWorkspaceName = (slug) => slug === 'mi-oficina' ? 'Vivo' : slug.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  async function workspaceName(slug) { return (await loadWorkspaces())[slug]?.name ?? defaultWorkspaceName(slug); }
  const slugify = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'espacio';
  async function slugTaken(slug) {
    if ((await loadWorkspaces())[slug] || rooms.has(slug)) return true;
    try { await stat(join(dataDir, `${slug}.json`)); return true; } catch { /* free */ }
    try { await stat(join(dataDir, `${slug}.chat.json`)); return true; } catch { return false; }
  }
  async function createWorkspace(name, template) {
    const base = slugify(name);
    let slug = base;
    for (let n = 2; await slugTaken(slug); n++) slug = `${base}-${n}`.slice(0, 63);
    const list = await loadWorkspaces();
    list[slug] = { name, template, createdAt: new Date().toISOString() };
    if (template === 'office') {
      // Copy the design (furniture, moved or removed pieces, room names, interactive objects), not the people or the chat.
      let design = null;
      const live = rooms.get(templateRoom);
      if (live) { await live.loaded; design = { objects: live.objects, overrides: live.overrides, areaNames: live.areaNames, interactions: live.interactions }; }
      else { try { design = JSON.parse(await readFile(join(dataDir, `${templateRoom}.json`), 'utf8')); } catch { design = null; } }
      if (design && Array.isArray(design.objects)) {
        await mkdir(dataDir, { recursive: true });
        await writeFile(join(dataDir, `${slug}.json`), JSON.stringify({ version: 2, objects: design.objects, overrides: design.overrides ?? {}, areaNames: design.areaNames ?? {}, interactions: design.interactions ?? {} }), { mode: 0o600 });
      }
    }
    if (template === 'empty') {
      // An empty office keeps floors and walls; every piece of furniture starts removed and can be added back.
      const overrides = Object.fromEntries(BASE_OBJECTS.map((object) => [object.id, { removed: true }]));
      await mkdir(dataDir, { recursive: true });
      await writeFile(join(dataDir, `${slug}.json`), JSON.stringify({ version: 2, objects: [], overrides, areaNames: {}, interactions: {} }), { mode: 0o600 });
    }
    await saveWorkspaces();
    return { slug, name };
  }

  editPolicy ??= adminKey ? 'admins' : 'everyone'; // with an admin key, decorating defaults to admins
  const canEdit = (participant) => editPolicy === 'everyone' || participant.role === 'admin';
  const rooms = new Map();
  const clients = new Set();
  let closing = false;

  const send = (socket, payload) => {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 1_000_000) return socket.close(1013, 'Client too slow');
      socket.send(JSON.stringify(payload));
    }
  };
  const error = (socket, code, message) => send(socket, { type: 'error', code, message });
  const participants = (room) => [...room.members.values()].map((member) => { const { statusBeforeFocus, focusDeclined, ...shown } = member.participant; return shown; });
  const broadcast = (room, payload, predicate = () => true) => {
    for (const member of room.members.values()) if (predicate(member.participant)) send(member.socket, payload);
  };
  /** Meeting rooms: active while someone is inside; a locked room admits nobody new until it empties. */
  const meetingMembers = (room, areaId) => [...room.members.values()].filter((member) => meetingRoomOf(member.participant)?.id === areaId);
  const meetings = (room) => {
    const state = {};
    for (const member of room.members.values()) { const area = meetingRoomOf(member.participant); if (area) (state[area.id] ??= { active: true, locked: false, participants: 0 }).participants += 1; }
    for (const areaId of Object.keys(room.locks)) { if (state[areaId]) state[areaId].locked = true; else delete room.locks[areaId]; }
    for (const areaId of Object.keys(room.meetingStarts)) if (!state[areaId]) delete room.meetingStarts[areaId];
    for (const [areaId, meeting] of Object.entries(state)) meeting.startedAt = room.meetingStarts[areaId] ??= Date.now();
    // Music and recording belong to a meeting in progress; they end with it.
    for (const [areaId, extra] of Object.entries(room.meetingExtras)) {
      if (!state[areaId]) { delete room.meetingExtras[areaId]; continue; }
      if (extra.music) state[areaId].music = extra.music;
      if (extra.recordingBy && [...room.members.values()].some((member) => member.participant.id === extra.recordingBy && meetingRoomOf(member.participant)?.id === areaId)) state[areaId].recordingBy = extra.recordingBy;
      else delete extra.recordingBy;
    }
    return state;
  };
  const systemMessage = (room, areaId, participant, text) => broadcast(room, { type: 'chat', message: { id: randomUUID(), participantId: participant.id, name: participant.name, text, channel: 'meeting', areaId, system: true, createdAt: new Date().toISOString() } }, (other) => meetingRoomOf(other)?.id === areaId);
  /** Focus offices: alone in one, an active person switches to focus; leaving restores the previous status.
      A status chosen by hand inside the office is respected until the person leaves. */
  const applyFocusZones = (room) => {
    const people = [...room.members.values()].map((member) => member.participant);
    for (const person of people) {
      const zone = focusRoomOf(person);
      if (person.focusZone && person.focusZone !== zone?.id) {
        if (person.status === 'focus') person.status = person.statusBeforeFocus ?? 'available';
        delete person.focusZone; delete person.statusBeforeFocus;
      }
      if (person.focusDeclined && person.focusDeclined !== zone?.id) delete person.focusDeclined;
      if (!zone || person.focusZone || person.focusDeclined === zone.id || person.status !== 'available') continue;
      const alone = !people.some((other) => other !== person && focusRoomOf(other)?.id === zone.id);
      if (alone) { person.statusBeforeFocus = person.status; person.status = 'focus'; person.focusZone = zone.id; }
    }
  };
  const broadcastParticipants = (room) => {
    applyFocusZones(room);
    const before = room.lastMeetings ?? {};
    const state = meetings(room);
    for (const [areaId, meeting] of Object.entries(state)) if (!before[areaId]) for (const member of meetingMembers(room, areaId)) systemMessage(room, areaId, member.participant, 'se unió');
    room.lastMeetings = state;
    for (const areaId of Object.keys(room.focus)) if (!insideFocus(room, areaId).length) delete room.focus[areaId]; // an empty office closes again for the next person
    broadcast(room, { type: 'participants', participants: participants(room), meetings: state, focusRooms: focusState(room) });
  };
  const lockedAgainst = (room, participant, point) => { const area = meetingRoomOf(point); return !!area && !!room.locks[area.id] && meetingRoomOf(participant)?.id !== area.id; };
  /** Focus offices close their door while someone is inside: only people let in from inside may enter. */
  const insideFocus = (room, areaId, except) => [...room.members.values()].filter((member) => member.participant !== except && focusRoomOf(member.participant)?.id === areaId);
  const focusClosedAgainst = (room, participant, point) => {
    const zone = focusRoomOf(point);
    if (!zone || focusRoomOf(participant)?.id === zone.id || !insideFocus(room, zone.id, participant).length) return false;
    const state = room.focus[zone.id];
    return !state?.open && !state?.guests?.includes(participant.id);
  };
  const focusState = (room) => Object.fromEntries(FOCUS_ROOMS.flatMap((area) => {
    const inside = insideFocus(room, area.id);
    if (!inside.length) return [];
    const state = room.focus[area.id] ?? {};
    return [[area.id, { occupied: true, open: !!state.open, guests: state.guests ?? [], people: inside.map((member) => member.participant.id) }]];
  }));
  /** Reject placements that trap a standing participant or seal an occupied chair's exits. */
  const placementProblem = (room, object, others, overrides = room.overrides) => {
    const next = object ? [...others, object] : others;
    for (const member of room.members.values()) {
      if (!member.participant.seatId) {
        if (object && officeObjectBlocksPoint(object, member.participant)) return 'Leave space around people before placing furniture.';
        continue;
      }
      const seat = getOfficeSeat(member.participant.seatId, next, overrides);
      if (!seat) return 'Someone is sitting on this object.';
      if (!canExitSeat(seat, next, overrides)) return 'Leave a free exit beside occupied chairs.';
    }
    return null;
  };
  const standParticipant = (room, participant, seat = getOfficeSeat(participant.seatId, room.objects, room.overrides)) => {
    delete participant.seatId;
    if (seat) Object.assign(participant, { x: seat.standX, y: seat.standY });
  };

  async function getRoom(slug) {
    if (rooms.has(slug)) {
      const room = rooms.get(slug);
      await room.loaded;
      return room;
    }
    if (rooms.size >= maxRooms) return null;
    const room = { slug, members: new Map(), channels: DEFAULT_CHANNELS.map((channel) => ({ ...channel })), history: {}, users: {}, events: [], desks: {}, focus: {}, chatWrite: Promise.resolve(), objects: [], overrides: {}, areaNames: {}, interactions: {}, locks: {}, meetingStarts: {}, meetingExtras: {}, lastMeetings: {}, writeQueue: Promise.resolve(), loaded: null };
    room.loaded = (async () => {
      room.workspaceName = await workspaceName(slug);
      try {
        const raw = await readFile(join(dataDir, `${slug}.json`), 'utf8');
        if (raw.length > 256_000) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved.objects)) return;
        if (saved.interactions && typeof saved.interactions === 'object') {
          for (const [id, interaction] of Object.entries(saved.interactions).slice(0, 500)) { const clean = cleanInteraction(interaction); if (clean && typeof id === 'string' && id.length <= 64) room.interactions[id] = clean; }
        }
        if (saved.areaNames && typeof saved.areaNames === 'object') {
          for (const [id, name] of Object.entries(saved.areaNames).slice(0, 100)) if (meetingRoom(id) && displayName(name)) room.areaNames[id] = displayName(name);
        }
        if (saved.overrides && typeof saved.overrides === 'object') {
          for (const [id, override] of Object.entries(saved.overrides).slice(0, MAX_OBJECTS)) if (validOverride(id, override)) room.overrides[id] = { ...override };
        }
        const ids = new Set();
        room.objects = saved.objects.slice(0, MAX_OBJECTS).flatMap((object) => {
          if (!object || typeof object.kind !== 'string' || typeof object.id !== 'string' || object.id.length > 64 || ids.has(object.id) || !validObject(object)) return [];
          const point = position(object.x, object.y);
          if (!point) return [];
          ids.add(object.id);
          return [{ id: object.id, kind: object.kind, ...(typeof object.color === 'string' ? { color: object.color } : {}), ...(typeof object.facing === 'string' ? { facing: object.facing } : {}), ...point, ...(object.free === true ? { free: true } : {}) }];
        });
      } catch (cause) {
        if (cause.code !== 'ENOENT') console.warn(`Could not load objects for room ${slug}: ${cause.message}`);
      }
      try {
        const raw = await readFile(join(dataDir, `${slug}.chat.json`), 'utf8');
        if (raw.length > 4_000_000) return;
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.channels)) for (const channel of saved.channels.slice(0, MAX_CHANNELS)) {
          const id = channelSlug(channel?.id);
          if (id && !room.channels.some((existing) => existing.id === id)) room.channels.push({ id, name: channelName(channel.name) || id, topic: cleanText(channel.topic, 160) });
        }
        if (saved.users && typeof saved.users === 'object') for (const [userId, user] of Object.entries(saved.users).slice(0, 500)) {
          if (USER_ID.test(userId) && displayName(user?.name)) room.users[userId] = { name: displayName(user.name), color: COLOR.test(user.color) ? user.color : '#7968e6' };
        }
        if (saved.history && typeof saved.history === 'object') for (const [key, messages] of Object.entries(saved.history).slice(0, 1000)) {
          if (!Array.isArray(messages) || !(room.channels.some((channel) => channel.id === key) || /^dm:[A-Za-z0-9_-]{8,64}:[A-Za-z0-9_-]{8,64}$/.test(key))) continue;
          room.history[key] = messages.slice(-MAX_HISTORY).filter((message) => message && typeof message.text === 'string' && typeof message.id === 'string').map((message) => ({
            id: message.id, participantId: String(message.participantId ?? ''), userId: String(message.userId ?? ''), name: displayName(message.name) || 'Invitado', text: cleanText(message.text, 4000),
            channel: key.startsWith('dm:') ? 'dm' : 'channel', ...(key.startsWith('dm:') ? { dmKey: key } : { channelId: key }), createdAt: String(message.createdAt ?? new Date().toISOString()),
          }));
        }
      } catch (cause) {
        if (cause.code !== 'ENOENT') console.warn(`Could not load chat for room ${slug}: ${cause.message}`);
      }
      try {
        const saved = JSON.parse(await readFile(join(dataDir, `${slug}.calendar.json`), 'utf8'));
        if (Array.isArray(saved.events)) room.events = saved.events.slice(0, MAX_EVENTS).flatMap((event) => {
          const start = isoTime(event?.start), end = isoTime(event?.end);
          if (!start || !end || end <= start || typeof event.id !== 'string' || !cleanText(event.title, 120)) return [];
          return [{ id: event.id, title: cleanText(event.title, 120), description: cleanText(event.description, 1000), start, end, areaId: typeof event.areaId === 'string' && meetingRoom(event.areaId) ? event.areaId : null, organizer: displayName(event.organizer) || 'Invitado', organizerId: String(event.organizerId ?? '') }];
        });
      } catch (cause) {
        if (cause.code !== 'ENOENT') console.warn(`Could not load calendar for room ${slug}: ${cause.message}`);
      }
      try {
        const saved = JSON.parse(await readFile(join(dataDir, `${slug}.desks.json`), 'utf8'));
        for (const [areaId, userId] of Object.entries(saved.desks ?? {})) if (DESK_IDS.has(areaId) && typeof userId === 'string' && USER_ID.test(userId)) room.desks[areaId] = userId;
      } catch (cause) {
        if (cause.code !== 'ENOENT') console.warn(`Could not load desks for room ${slug}: ${cause.message}`);
      }
    })();
    rooms.set(slug, room);
    await room.loaded;
    return room;
  }

  function persistObjects(room, socket) {
    const snapshot = JSON.stringify({ version: 2, objects: room.objects, overrides: room.overrides, areaNames: room.areaNames, interactions: room.interactions });
    room.writeQueue = room.writeQueue.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const destination = join(dataDir, `${room.slug}.json`);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, destination);
    }).catch((cause) => {
      console.error(`Could not save objects for room ${room.slug}: ${cause.message}`);
      error(socket, 'persistence_failed', 'The change is visible, but could not be saved to disk.');
    });
  }

  function persistChat(room) {
    const snapshot = JSON.stringify({ version: 1, channels: room.channels, users: room.users, history: room.history });
    room.chatWrite = room.chatWrite.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const destination = join(dataDir, `${room.slug}.chat.json`);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, destination);
    }).catch((cause) => console.error(`Could not save chat for room ${room.slug}: ${cause.message}`));
  }
  function persistDesks(room) {
    const snapshot = JSON.stringify({ version: 1, desks: room.desks });
    room.chatWrite = room.chatWrite.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const destination = join(dataDir, `${room.slug}.desks.json`);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, destination);
    }).catch((cause) => console.error(`Could not save desks for room ${room.slug}: ${cause.message}`));
  }
  function persistEvents(room) {
    const snapshot = JSON.stringify({ version: 1, events: room.events });
    room.chatWrite = room.chatWrite.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const destination = join(dataDir, `${room.slug}.calendar.json`);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, destination);
    }).catch((cause) => console.error(`Could not save calendar for room ${room.slug}: ${cause.message}`));
  }
  /** The history a member may read: every channel, plus direct messages that include them. */
  const visibleHistory = (room, userId) => Object.entries(room.history).filter(([key]) => !key.startsWith('dm:') || key.split(':').slice(1).includes(userId)).flatMap(([, messages]) => messages).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const directory = (room) => Object.entries(room.users).map(([userId, user]) => ({ userId, ...user }));

  // Large headers (many cookies on localhost) are accepted instead of answering HTTP 431.
  const server = http.createServer({ maxHeaderSize: 64 * 1024 }, (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'open-office', rooms: rooms.size, participants: [...rooms.values()].reduce((sum, room) => sum + room.members.size, 0) }));
      return;
    }
    const security = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
    if (request.method === 'GET' && request.url === '/config') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...security });
      response.end(JSON.stringify({ accessRequired: !!accessKey, editPolicy, iceServers, accounts: accountMode, sfu: !!livekit }));
      return;
    }
    if (request.url === '/api/workspaces' || request.url?.startsWith('/api/workspaces/')) {
      const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...security }); response.end(JSON.stringify(body)); };
      if (request.method === 'GET' && request.url.split('?')[0] === '/api/workspaces') {
        // Every workspace on this server, so the whole team sees the same list (with the invite key when one is set).
        const key = new URL(request.url, 'http://localhost').searchParams.get('key') ?? '';
        if (accessKey && !sameSecret(key, accessKey)) return reply(403, { error: 'access_denied' });
        void loadWorkspaces().then((list) => {
          const slugs = new Set([templateRoom, ...Object.keys(list)]);
          reply(200, { workspaces: [...slugs].map((slug) => ({ slug, name: list[slug]?.name ?? defaultWorkspaceName(slug), createdAt: list[slug]?.createdAt ?? null, online: rooms.get(slug)?.members.size ?? 0, main: slug === templateRoom })) });
        });
        return;
      }
      if (request.method === 'DELETE' && request.url.startsWith('/api/workspaces/')) {
        if (!validOrigin(request.headers.origin, request.headers.host, allowedOrigins)) return reply(403, { error: 'forbidden' });
        let body = '';
        request.on('data', (chunk) => { body += chunk; if (body.length > 4096) request.destroy(); });
        request.on('end', async () => {
          let payload; try { payload = JSON.parse(body || '{}'); } catch { return reply(400, { error: 'invalid_json' }); }
          const slug = decodeURIComponent(request.url.slice('/api/workspaces/'.length));
          if (!ROOM_SLUG.test(slug)) return reply(400, { error: 'invalid_workspace' });
          if (slug === templateRoom) return reply(400, { error: 'main_workspace' });
          if (accessKey && !sameSecret(String(payload.key ?? ''), accessKey)) return reply(403, { error: 'access_denied' });
          if (editPolicy === 'admins' && !(adminKey && sameSecret(String(payload.admin ?? ''), adminKey))) return reply(403, { error: 'forbidden' });
          if ((rooms.get(slug)?.members.size ?? 0) > 0) return reply(409, { error: 'occupied' });
          const list = await loadWorkspaces();
          if (!list[slug]) return reply(404, { error: 'not_found' });
          delete list[slug]; await saveWorkspaces();
          rooms.delete(slug);
          const { rm } = await import('node:fs/promises');
          for (const suffix of ['json', 'chat.json', 'calendar.json', 'desks.json']) await rm(join(dataDir, `${slug}.${suffix}`), { force: true });
          return reply(200, { ok: true });
        });
        return;
      }
      if (request.method === 'GET' && request.url.startsWith('/api/workspaces/')) {
        const slug = decodeURIComponent(request.url.slice('/api/workspaces/'.length));
        if (!ROOM_SLUG.test(slug)) return reply(400, { error: 'invalid_workspace' });
        void loadWorkspaces().then((list) => reply(200, { slug, name: list[slug]?.name ?? defaultWorkspaceName(slug), template: list[slug]?.template ?? 'office' }));
        return;
      }
      const renaming = request.method === 'PATCH' && request.url.startsWith('/api/workspaces/');
      if ((!renaming && (request.method !== 'POST' || request.url !== '/api/workspaces')) || !validOrigin(request.headers.origin, request.headers.host, allowedOrigins)) return reply(403, { error: 'forbidden' });
      const ip = request.socket.remoteAddress ?? 'unknown';
      const bucket = workspaceRate.get(ip) ?? { tokens: 5, at: Date.now() }; workspaceRate.set(ip, bucket);
      if (!takeToken(bucket, 5, 0.05)) return reply(429, { error: 'too_many_attempts' });
      let body = '';
      request.on('data', (chunk) => { body += chunk; if (body.length > 4096) request.destroy(); });
      request.on('end', async () => {
        let payload; try { payload = JSON.parse(body || '{}'); } catch { return reply(400, { error: 'invalid_json' }); }
        if (accessKey && !sameSecret(String(payload.key ?? ''), accessKey)) return reply(403, { error: 'access_denied' });
        const name = cleanText(payload.name, 60);
        if (!name || name.length < 2) return reply(400, { error: 'invalid_name' });
        if (renaming) {
          // Renaming follows the decorating rule: anyone, or only admins (with the admin key) when the office restricts it.
          const slug = decodeURIComponent(request.url.slice('/api/workspaces/'.length));
          if (!ROOM_SLUG.test(slug)) return reply(400, { error: 'invalid_workspace' });
          if (editPolicy === 'admins' && !(adminKey && sameSecret(String(payload.admin ?? ''), adminKey))) return reply(403, { error: 'forbidden' });
          const list = await loadWorkspaces();
          list[slug] = { ...(list[slug] ?? { template: 'office', createdAt: new Date().toISOString() }), name };
          await saveWorkspaces();
          const live = rooms.get(slug);
          if (live) { live.workspaceName = name; broadcast(live, { type: 'workspace', workspace: { slug, name } }); }
          return reply(200, { slug, name });
        }
        const template = payload.template === 'empty' ? 'empty' : 'office';
        try { return reply(201, await createWorkspace(name, template)); }
        catch (cause) { console.error(`Could not create workspace: ${cause.message}`); return reply(500, { error: 'workspace_failed' }); }
      });
      return;
    }
    if (request.url?.startsWith('/api/') && accounts) {
      const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...security }); response.end(JSON.stringify(body)); };
      if (request.method !== 'POST' || !validOrigin(request.headers.origin, request.headers.host, allowedOrigins)) return reply(403, { error: 'forbidden' });
      const ip = request.socket.remoteAddress ?? 'unknown';
      const bucket = loginRate.get(ip) ?? { tokens: 10, at: Date.now() }; loginRate.set(ip, bucket);
      if (!takeToken(bucket, 10, 0.2)) return reply(429, { error: 'too_many_attempts' });
      let body = '';
      request.on('data', (chunk) => { body += chunk; if (body.length > 4096) request.destroy(); });
      request.on('end', async () => {
        let payload; try { payload = JSON.parse(body || '{}'); } catch { return reply(400, { error: 'invalid_json' }); }
        if (request.url === '/api/register') { const result = await accounts.register(payload); return reply(result.error ? 400 : 200, result); }
        if (request.url === '/api/login') { const result = await accounts.login(payload); return reply(result.error ? 401 : 200, result); }
        if (request.url === '/api/logout') { await accounts.logout(payload.token); return reply(200, { ok: true }); }
        if (request.url === '/api/me') { const user = await accounts.session(payload.token); return reply(user ? 200 : 401, user ? { user } : { error: 'invalid_session' }); }
        return reply(404, { error: 'Not found' });
      });
      return;
    }
    if ((request.method === 'GET' || request.method === 'HEAD') && staticDir) {
      void (async () => {
        let path;
        try { path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); } catch { path = '/'; }
        let file = normalize(join(staticDir, path));
        if (!file.startsWith(staticDir + sep) && file !== staticDir) file = join(staticDir, 'index.html');
        try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
        catch { file = extname(path) ? '' : join(staticDir, 'index.html'); } // client-side routes fall back to the app
        try {
          if (!file) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
          const body = await readFile(file);
          const immutable = file.includes(`${sep}assets${sep}`) && /-[A-Za-z0-9_-]{8,}\./.test(file);
          response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ...security });
          response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
          response.writeHead(404, { 'Content-Type': 'application/json', ...security });
          response.end(JSON.stringify({ error: 'Not found' }));
        }
      })();
      return;
    }
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 65_536, perMessageDeflate: false });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try { url = new URL(request.url, 'http://localhost'); } catch { socket.destroy(); return; }
    const slug = url.searchParams.get('room') || 'demo';
    if (closing || url.pathname !== '/ws' || !ROOM_SLUG.test(slug) || !validOrigin(request.headers.origin, request.headers.host, allowedOrigins)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    if (clients.size >= maxRooms * maxParticipants) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (websocket) => wss.emit('connection', websocket, slug));
  });

  wss.on('connection', (socket, slug) => {
    const now = Date.now();
    const client = { socket, room: null, participant: null, alive: true, queue: Promise.resolve(), rate: { tokens: 120, at: now }, chatRate: { tokens: 8, at: now }, editRate: { tokens: 12, at: now } };
    clients.add(client);
    const joinTimeout = setTimeout(() => { if (!client.participant) socket.close(1008, 'Join required'); }, 10_000);
    joinTimeout.unref();

    async function receive(raw, binary) {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (binary) return error(socket, 'invalid_message', 'Send JSON text messages.');
      let payload;
      try { payload = JSON.parse(raw.toString()); } catch { return error(socket, 'invalid_json', 'Invalid JSON.'); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.type !== 'string') return error(socket, 'invalid_message', 'A message type is required.');
      if (payload.type === 'join') {
        if (client.participant) return error(socket, 'already_joined', 'This connection already joined a room.');
        if (accessKey && !sameSecret(payload.accessKey, accessKey)) { error(socket, 'access_denied', 'This office needs a valid invite key.'); socket.close(1008, 'Access denied'); return; }
        const account = accounts ? await accounts.session(payload.sessionToken) : null;
        if (accountMode === 'required' && !account) { error(socket, 'login_required', 'Sign in to enter this office.'); socket.close(1008, 'Login required'); return; }
        const room = await getRoom(slug);
        if (!room) return error(socket, 'server_full', 'No rooms are currently available.');
        if (socket.readyState !== WebSocket.OPEN) return;
        if (room.members.size >= maxParticipants) return error(socket, 'room_full', 'This room is full.');
        clearTimeout(joinTimeout);
        client.room = room;
        const participantId = randomUUID();
        client.participant = { id: participantId, userId: account ? `acct-${account.id}` : typeof payload.userId === 'string' && USER_ID.test(payload.userId) ? payload.userId : participantId, name: displayName(payload.name) || account?.name || 'Invitado', color: typeof payload.color === 'string' && COLOR.test(payload.color) ? payload.color : '#7968e6', x: SPAWN.x, y: SPAWN.y, facing: 'south', status: 'available', mic: false, camera: false, screen: false };
        const look = sanitizeLook(payload.avatar); if (look) client.participant.avatar = look;
        client.participant.role = adminKey && sameSecret(payload.adminKey, adminKey) ? 'admin' : 'member';
        if (account) client.participant.verified = true;
        room.users[client.participant.userId] = { name: client.participant.name, color: client.participant.color };
        room.members.set(client.participant.id, client);
        broadcast(room, { type: 'users', users: directory(room) }, (other) => other.id !== client.participant.id);
        persistChat(room);
        send(socket, { type: 'welcome', id: client.participant.id, userId: client.participant.userId, role: client.participant.role, editPolicy, participants: participants(room), meetings: meetings(room), channels: room.channels, users: directory(room), events: room.events, messages: visibleHistory(room, client.participant.userId), objects: room.objects, overrides: room.overrides, areaNames: room.areaNames, interactions: room.interactions , desks: room.desks , workspace: { slug: room.slug, name: room.workspaceName } });
        broadcastParticipants(room);
        return;
      }
      if (!client.participant) return error(socket, 'join_required', 'Join a room first.');
      const { room, participant } = client;
      switch (payload.type) {
        case 'move': {
          if (participant.seatId) return error(socket, 'seat_unavailable', 'Stand up before moving.');
          const point = position(payload.x, payload.y);
          if (!point) return error(socket, 'invalid_position', 'Position must contain finite numbers.');
          if (lockedAgainst(room, participant, point)) return error(socket, 'meeting_locked', 'This meeting is locked.');
          if (focusClosedAgainst(room, participant, point)) return send(socket, { type: 'error', code: 'focus_closed', areaId: focusRoomOf(point).id, message: 'Someone is focusing in this office. Knock to ask to come in.' });
          const dx = point.x - participant.x;
          const dy = point.y - participant.y;
          if (dx || dy) participant.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
          else if (FACINGS.has(payload.facing)) participant.facing = payload.facing;
          Object.assign(participant, point);
          broadcastParticipants(room);
          break;
        }
        case 'seat:sit': {
          const seat = getOfficeSeat(payload.seatId, room.objects, room.overrides);
          if (!seat) return error(socket, 'invalid_seat', 'Choose a chair in this office.');
          if (lockedAgainst(room, participant, seat)) return error(socket, 'meeting_locked', 'This meeting is locked.');
          if (focusClosedAgainst(room, participant, seat)) return send(socket, { type: 'error', code: 'focus_closed', areaId: focusRoomOf(seat).id, message: 'Someone is focusing in this office. Knock to ask to come in.' });
          if (participant.status === 'away' || (participant.seatId && participant.seatId !== seat.id)
            || [...room.members.values()].some(member => member !== client && member.participant.seatId === seat.id)
            || !canExitSeat(seat, room.objects, room.overrides)) return error(socket, 'seat_unavailable', 'This chair is currently unavailable.');
          if (Math.hypot(participant.x - seat.x, participant.y - seat.y) > SEAT_INTERACTION_RADIUS) return error(socket, 'seat_too_far', 'Walk closer to the chair before sitting.');
          if (participant.seatId !== seat.id && !canApproachSeat(participant, seat, room.objects, room.overrides)) return error(socket, 'seat_unavailable', 'Walk to the accessible side of the chair first.');
          Object.assign(participant, { x: seat.x, y: seat.y, facing: seat.facing, seatId: seat.id });
          broadcastParticipants(room);
          break;
        }
        case 'seat:stand': {
          if (participant.seatId) standParticipant(room, participant);
          broadcastParticipants(room);
          break;
        }
        case 'profile': {
          let changed = false;
          const name = displayName(payload.name);
          if (name) { participant.name = name; changed = true; }
          if (typeof payload.color === 'string' && COLOR.test(payload.color)) { participant.color = payload.color; changed = true; }
          if (STATUSES.has(payload.status)) {
            if (participant.status !== payload.status && focusRoomOf(participant)) { participant.focusDeclined = focusRoomOf(participant).id; delete participant.focusZone; delete participant.statusBeforeFocus; }
            participant.status = payload.status; changed = true;
          }
          if (payload.avatar !== undefined) { const look = sanitizeLook(payload.avatar); if (look) { participant.avatar = look; changed = true; } }
          if (typeof payload.handRaised === 'boolean') { if (payload.handRaised) participant.handRaised = true; else delete participant.handRaised; changed = true; }
          if (typeof payload.statusText === 'string') { const text = cleanText(payload.statusText, 60); if (text) participant.statusText = text; else delete participant.statusText; changed = true; }
          for (const key of ['mic', 'camera', 'screen']) if (typeof payload[key] === 'boolean') { participant[key] = payload[key]; changed = true; }
          if (changed) {
            room.users[participant.userId] = { name: participant.name, color: participant.color };
            broadcastParticipants(room);
            broadcast(room, { type: 'users', users: directory(room) });
          }
          break;
        }
        case 'chat': {
          if (!takeToken(client.chatRate, 8, 0.8)) return error(socket, 'chat_rate_limit', 'Wait a moment before sending another message.');
          const kind = payload.channel === 'office' ? 'channel' : payload.channel;
          if (typeof payload.text !== 'string' || !['channel', 'dm', 'nearby', 'meeting'].includes(kind)) return error(socket, 'invalid_chat', 'Choose a channel, a direct message, nearby or meeting and provide text.');
          const messageText = cleanText(payload.text, 4001);
          if (!messageText || messageText.length > 4000) return error(socket, 'invalid_chat', 'Messages must contain 1 to 4000 characters.');
          const base = { id: randomUUID(), participantId: participant.id, userId: participant.userId, name: participant.name, text: messageText, createdAt: new Date().toISOString() };
          if (kind === 'channel') {
            const channelId = payload.channel === 'office' ? 'general' : channelSlug(payload.channelId);
            if (!room.channels.some((channel) => channel.id === channelId)) return error(socket, 'invalid_chat', 'Unknown channel.');
            const message = { ...base, channel: 'channel', channelId };
            (room.history[channelId] ??= []).push(message);
            if (room.history[channelId].length > MAX_HISTORY) room.history[channelId].shift();
            persistChat(room);
            broadcast(room, { type: 'chat', message });
            break;
          }
          if (kind === 'dm') {
            if (typeof payload.to !== 'string' || !room.users[payload.to]) return error(socket, 'invalid_chat', 'Choose someone from this office.');
            const key = dmKey(participant.userId, payload.to);
            const message = { ...base, channel: 'dm', dmKey: key, to: payload.to };
            (room.history[key] ??= []).push(message);
            if (room.history[key].length > MAX_HISTORY) room.history[key].shift();
            persistChat(room);
            broadcast(room, { type: 'chat', message }, (other) => other.userId === participant.userId || other.userId === payload.to);
            break;
          }
          const meetingArea = kind === 'meeting' ? meetingRoomOf(participant) : null;
          if (kind === 'meeting' && !meetingArea) return error(socket, 'invalid_chat', 'Join a meeting room to use its chat.');
          const message = { ...base, channel: kind, ...(meetingArea ? { areaId: meetingArea.id } : {}) };
          broadcast(room, { type: 'chat', message }, (other) => meetingArea ? meetingRoomOf(other)?.id === meetingArea.id : sharesConversationArea(participant, other, CHAT_RADIUS));
          break;
        }
        case 'channel:create': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const id = channelSlug(payload.name);
          if (!id) return error(socket, 'invalid_channel', 'Channel names need letters or numbers.');
          if (room.channels.some((channel) => channel.id === id)) return error(socket, 'invalid_channel', 'A channel with this name already exists.');
          if (room.channels.length >= MAX_CHANNELS) return error(socket, 'invalid_channel', 'This office has reached its channel limit.');
          room.channels.push({ id, name: channelName(payload.name) || id, topic: cleanText(payload.topic, 160) });
          persistChat(room);
          broadcast(room, { type: 'channels', channels: room.channels, created: id, by: participant.id });
          break;
        }
        case 'focus:knock': {
          const area = FOCUS_ROOMS.find((candidate) => candidate.id === payload.areaId);
          if (!area || focusRoomOf(participant)?.id === area.id) return error(socket, 'invalid_focus', 'Knock on an office you are outside of.');
          const inside = insideFocus(room, area.id);
          if (!inside.length) return;
          const now = Date.now(); client.knocks ??= {};
          if (now - (client.knocks[area.id] ?? 0) < 8000) return error(socket, 'knock_rate_limit', 'Wait a moment before knocking again.');
          client.knocks[area.id] = now;
          for (const member of inside) send(member.socket, { type: 'focus:knock', areaId: area.id, from: { id: participant.id, name: participant.name } });
          break;
        }
        case 'focus:admit': {
          const zone = focusRoomOf(participant);
          if (!zone || zone.id !== payload.areaId || typeof payload.participantId !== 'string') return error(socket, 'invalid_focus', 'Only someone inside can let people in.');
          const guest = [...room.members.values()].find((member) => member.participant.id === payload.participantId);
          if (!guest) return;
          const state = room.focus[zone.id] ??= { open: false, guests: [] };
          if (!state.guests.includes(guest.participant.id)) state.guests.push(guest.participant.id);
          send(guest.socket, { type: 'focus:admitted', areaId: zone.id, by: participant.name });
          broadcastParticipants(room);
          break;
        }
        case 'focus:door': {
          const zone = focusRoomOf(participant);
          if (!zone || zone.id !== payload.areaId || typeof payload.open !== 'boolean') return error(socket, 'invalid_focus', 'Only someone inside can open or close the door.');
          const state = room.focus[zone.id] ??= { open: false, guests: [] };
          state.open = payload.open;
          broadcastParticipants(room);
          break;
        }
        case 'workspace:rename': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can rename the workspace.');
          const name = cleanText(payload.name, 60);
          if (!name || name.length < 2) return error(socket, 'invalid_workspace', 'Names need 2 to 60 characters.');
          const list = await loadWorkspaces();
          list[room.slug] = { ...(list[room.slug] ?? { template: 'office', createdAt: new Date().toISOString() }), name };
          room.workspaceName = name;
          void saveWorkspaces();
          broadcast(room, { type: 'workspace', workspace: { slug: room.slug, name } });
          break;
        }
        case 'desk:assign': {
          // Anyone may claim a free desk or give up their own; assigning desks to others needs edit rights.
          const areaId = payload.areaId, userId = payload.userId === null ? null : payload.userId;
          if (typeof areaId !== 'string' || !DESK_IDS.has(areaId) || (userId !== null && (typeof userId !== 'string' || !room.users[userId]))) return error(socket, 'invalid_desk', 'Choose a desk and someone from this office.');
          const owner = room.desks[areaId] ?? null;
          const self = participant.userId;
          const allowed = canEdit(participant) || (userId === self && owner === null) || (userId === null && owner === self);
          if (!allowed) return error(socket, 'forbidden', 'Only office admins can assign desks to other people.');
          if (userId === null) delete room.desks[areaId];
          else {
            for (const [other, holder] of Object.entries(room.desks)) if (holder === userId) delete room.desks[other]; // one desk per person
            room.desks[areaId] = userId;
          }
          broadcast(room, { type: 'desks', desks: room.desks });
          persistDesks(room);
          break;
        }
        case 'media:token': {
          const area = meetingRoomOf(participant);
          if (!livekit || !area) return error(socket, 'sfu_unavailable', 'The media server is only used inside meeting rooms.');
          const roomName = `${room.slug}--${area.id}`;
          send(socket, { type: 'media:token', url: livekit.url, room: roomName, areaId: area.id, token: livekitToken({ key: livekit.key, secret: livekit.secret, identity: participant.id, name: participant.name, room: roomName }) });
          break;
        }
        case 'react': {
          if (!takeToken(client.chatRate, 8, 0.8)) return error(socket, 'chat_rate_limit', 'Wait a moment before reacting again.');
          if (!REACTIONS.has(payload.emoji)) return error(socket, 'invalid_reaction', 'Choose one of the available reactions.');
          broadcast(room, { type: 'reaction', participantId: participant.id, emoji: payload.emoji, at: Date.now() });
          break;
        }
        case 'event:create': {
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const title = cleanText(payload.title, 120), start = isoTime(payload.start), end = isoTime(payload.end);
          if (!title || !start || !end || end <= start || Date.parse(end) - Date.parse(start) > 24 * 3_600_000) return error(socket, 'invalid_event', 'Give the meeting a title and a start before its end, within one day.');
          if (payload.areaId != null && !(typeof payload.areaId === 'string' && meetingRoom(payload.areaId))) return error(socket, 'invalid_event', 'Choose a meeting room of this office.');
          if (room.events.length >= MAX_EVENTS) room.events.sort((a, b) => a.end.localeCompare(b.end)).shift();
          const event = { id: randomUUID(), title, description: cleanText(payload.description, 1000), start, end, areaId: payload.areaId ?? null, organizer: participant.name, organizerId: participant.userId };
          room.events.push(event);
          persistEvents(room);
          broadcast(room, { type: 'events', events: room.events, created: event.id, by: participant.id });
          break;
        }
        case 'event:delete': {
          const index = room.events.findIndex((event) => event.id === payload.id);
          if (index === -1) return error(socket, 'invalid_event', 'Unknown meeting.');
          if (room.events[index].organizerId !== participant.userId) return error(socket, 'invalid_event', 'Only the organizer can cancel this meeting.');
          room.events.splice(index, 1);
          persistEvents(room);
          broadcast(room, { type: 'events', events: room.events });
          break;
        }
        case 'channel:update': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          const channel = room.channels.find((candidate) => candidate.id === channelSlug(payload.channelId));
          if (!channel) return error(socket, 'invalid_channel', 'Unknown channel.');
          channel.topic = cleanText(payload.topic, 160);
          persistChat(room);
          broadcast(room, { type: 'channels', channels: room.channels });
          break;
        }
        case 'area:rename': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const area = typeof payload.areaId === 'string' ? meetingRoom(payload.areaId) : null;
          const name = displayName(payload.name);
          if (!area || !name) return error(socket, 'invalid_area', 'Choose a meeting room and a name of 1 to 40 characters.');
          if (name === area.name) delete room.areaNames[area.id]; else room.areaNames[area.id] = name;
          persistObjects(room, socket);
          broadcast(room, { type: 'areas', areaNames: room.areaNames });
          break;
        }
        case 'meeting:music': {
          const area = meetingRoomOf(participant);
          if (!area || typeof payload.playing !== 'boolean') return error(socket, 'invalid_meeting', 'Join a meeting room to play music.');
          const extra = room.meetingExtras[area.id] ??= {};
          if (payload.playing) extra.music = { startedAt: Date.now(), by: participant.name }; else delete extra.music;
          systemMessage(room, area.id, participant, payload.playing ? 'puso música para todos' : 'detuvo la música');
          broadcastParticipants(room);
          break;
        }
        case 'meeting:record': {
          const area = meetingRoomOf(participant);
          if (!area || typeof payload.recording !== 'boolean') return error(socket, 'invalid_meeting', 'Join a meeting room to record.');
          const extra = room.meetingExtras[area.id] ??= {};
          if (payload.recording) { if (extra.recordingBy && extra.recordingBy !== participant.id) return error(socket, 'invalid_meeting', 'Someone else is already recording.'); extra.recordingBy = participant.id; }
          else if (extra.recordingBy === participant.id) delete extra.recordingBy;
          else return;
          systemMessage(room, area.id, participant, payload.recording ? 'empezó a grabar la reunión' : 'detuvo la grabación');
          broadcastParticipants(room);
          break;
        }
        case 'meeting:lock': {
          const area = typeof payload.areaId === 'string' ? meetingRoom(payload.areaId) : null;
          if (!area || typeof payload.locked !== 'boolean') return error(socket, 'invalid_meeting', 'Choose a meeting room and a lock state.');
          if (meetingRoomOf(participant)?.id !== area.id) return error(socket, 'invalid_meeting', 'Only people in the meeting can lock it.');
          if (!!room.locks[area.id] === payload.locked) return;
          if (payload.locked) room.locks[area.id] = participant.id; else delete room.locks[area.id];
          systemMessage(room, area.id, participant, payload.locked ? 'bloqueó la reunión' : 'desbloqueó la reunión');
          broadcastParticipants(room);
          break;
        }
        case 'object:add': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const point = position(payload.x, payload.y);
          if (!point || typeof payload.kind !== 'string' || !validObject(payload)) return error(socket, 'invalid_object', 'Choose a supported object and finite position.');
          if (room.objects.length >= MAX_OBJECTS) return error(socket, 'object_limit', 'This room has reached its object limit.');
          const addedObject = { id: randomUUID(), kind: payload.kind, ...(typeof payload.color === 'string' ? { color: payload.color } : {}), ...(typeof payload.facing === 'string' ? { facing: payload.facing } : {}), ...point, ...(payload.free === true ? { free: true } : {}) };
          const problem = placementProblem(room, addedObject, room.objects);
          if (problem) return error(socket, 'invalid_object', problem);
          room.objects = [...room.objects, addedObject];
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
          break;
        }
        case 'object:update': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          if (typeof payload.id !== 'string') return error(socket, 'invalid_object', 'An object ID is required.');
          if (isBaseObjectId(payload.id) && payload.reset === true) {
            // Back to the reference map's own placement (used by undo).
            if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`${payload.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
            const nextOverrides = { ...room.overrides }; delete nextOverrides[payload.id];
            const problem = placementProblem(room, null, room.objects, nextOverrides);
            if (problem) return error(socket, 'invalid_object', problem);
            room.overrides = nextOverrides;
            persistObjects(room, socket);
            broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
            break;
          }
          if (isBaseObjectId(payload.id)) {
            const current = baseAsEditorObject(payload.id, room.overrides);
            const override = { ...(room.overrides[payload.id] ?? {}) };
            delete override.removed;
            if (payload.rotate) { const facing = nextFacing(current); if (facing) override.facing = facing; }
            if (typeof payload.facing === 'string' && OBJECT_FACINGS.has(payload.facing)) override.facing = payload.facing;
            if (payload.x !== undefined || payload.y !== undefined) { const point = position(payload.x, payload.y); if (!point) return error(socket, 'invalid_position', 'Position must contain finite numbers.'); Object.assign(override, point); if (payload.free === true) override.free = true; else delete override.free; }
            if (!validOverride(payload.id, override)) return error(socket, 'invalid_object', 'Unsupported variant.');
            if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`${payload.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
            const nextOverrides = { ...room.overrides, [payload.id]: override };
            const problem = placementProblem(room, null, room.objects, nextOverrides);
            if (problem) return error(socket, 'invalid_object', problem);
            room.overrides = nextOverrides;
            persistObjects(room, socket);
            broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
            break;
          }
          const index = room.objects.findIndex((object) => object.id === payload.id);
          if (index === -1) return error(socket, 'invalid_object', 'Unknown object.');
          const current = room.objects[index];
          const updated = { ...current };
          if (payload.rotate) { const facing = nextFacing(current); if (facing) updated.facing = facing; }
          if (typeof payload.facing === 'string' && OBJECT_FACINGS.has(payload.facing)) updated.facing = payload.facing;
          if (payload.x !== undefined || payload.y !== undefined) { const point = position(payload.x, payload.y); if (!point) return error(socket, 'invalid_position', 'Position must contain finite numbers.'); Object.assign(updated, point); if (payload.free === true) updated.free = true; else delete updated.free; }
          if (!validObject(updated)) return error(socket, 'invalid_object', 'Unsupported variant.');
          if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`object:${current.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
          const others = room.objects.filter((object) => object.id !== current.id);
          const problem = placementProblem(room, updated, others);
          if (problem) return error(socket, 'invalid_object', problem);
          room.objects = [...others.slice(0, index), updated, ...others.slice(index)];
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
          break;
        }
        case 'object:interaction': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (typeof payload.id !== 'string' || !(isBaseObjectId(payload.id) || room.objects.some((object) => object.id === payload.id))) return error(socket, 'invalid_object', 'Unknown object.');
          if (payload.interaction === null) delete room.interactions[payload.id];
          else { const clean = cleanInteraction(payload.interaction); if (!clean) return error(socket, 'invalid_object', 'Give a valid website address or a note.'); room.interactions[payload.id] = clean; }
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
          break;
        }
        case 'object:remove': {
          if (!canEdit(participant)) return error(socket, 'forbidden', 'Only office admins can change this.');
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          if (typeof payload.id !== 'string') return error(socket, 'invalid_object', 'An object ID is required.');
          if (isBaseObjectId(payload.id)) {
            if (room.overrides[payload.id]?.removed) return;
            if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`${payload.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
            const nextOverrides = { ...room.overrides, [payload.id]: { removed: true } };
            const problem = placementProblem(room, null, room.objects, nextOverrides);
            if (problem) return error(socket, 'invalid_object', problem);
            room.overrides = nextOverrides;
            persistObjects(room, socket);
            broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
            break;
          }
          const index = room.objects.findIndex((object) => object.id === payload.id);
          if (index === -1) return;
          const removedSeats = getOfficeSeats(room.objects, room.overrides).filter((seat) => seat.objectId === `object:${payload.id}`);
          room.objects.splice(index, 1);
          let stoodUp = false;
          for (const removedSeat of removedSeats) for (const member of room.members.values()) {
            if (member.participant.seatId === removedSeat.id) {
              standParticipant(room, member.participant, removedSeat);
              stoodUp = true;
            }
          }
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides, interactions: room.interactions });
          if (stoodUp) broadcastParticipants(room);
          break;
        }
        case 'signal': {
          if (typeof payload.to !== 'string' || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return error(socket, 'invalid_signal', 'A target and signal object are required.');
          const target = room.members.get(payload.to);
          if (!target || target === client || !canConnect(participant, target.participant)) return error(socket, 'peer_unavailable', 'This participant is outside your conversation area.');
          send(target.socket, { type: 'signal', from: participant.id, data: payload.data });
          break;
        }
        default:
          error(socket, 'unknown_type', 'Unknown message type.');
      }
    }

    socket.on('message', (raw, binary) => {
      if (!takeToken(client.rate, 120, 90)) {
        socket.close(1008, 'Rate limit exceeded');
        return;
      }
      client.queue = client.queue.then(() => receive(raw, binary)).catch((cause) => {
        console.error(`WebSocket message failed: ${cause.message}`);
        error(socket, 'internal_error', 'Could not process the message.');
      });
    });
    socket.on('pong', () => { client.alive = true; });
    socket.on('error', () => {}); // Close cleanup handles failed transports and oversized messages.
    socket.on('close', () => {
      clearTimeout(joinTimeout);
      clients.delete(client);
      if (client.room && client.participant) {
        client.room.members.delete(client.participant.id);
        broadcastParticipants(client.room);
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) { client.socket.terminate(); continue; }
      client.alive = false;
      client.socket.ping();
    }
  }, 30_000);
  heartbeat.unref();

  try {
    await new Promise((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); resolveListen(); });
    });
  } catch (cause) {
    clearInterval(heartbeat);
    wss.close();
    throw cause;
  }

  return {
    server,
    wss,
    host,
    port: server.address().port,
    async close() {
      if (closing) return;
      closing = true;
      clearInterval(heartbeat);
      for (const client of clients) client.socket.terminate();
      await Promise.all([
        new Promise((done) => wss.close(done)),
        new Promise((done) => server.close(done)),
        ...[...rooms.values()].flatMap((room) => [room.writeQueue, room.chatWrite]),
        accounts?.writing,
      ]);
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const instance = await startServer();
  console.log(`Open Office realtime server: http://${instance.host}:${instance.port}`);
  const shutdown = async () => { await instance.close(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
