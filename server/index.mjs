import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { OFFICE_SIZE as MAP, MEDIA_RADIUS, CHAT_RADIUS, SPAWN, sharesConversationArea } from '../shared/office-world.js';
import { canApproachSeat, canExitSeat, getOfficeSeat, getOfficeSeats, SEAT_INTERACTION_RADIUS } from '../shared/office-seats.js';
import { baseAsEditorObject, catalogEntry, isBaseObjectId, nextFacing, officeObjectBlocksPoint, validOverride } from '../shared/office-objects.js';
import { meetingRoom, meetingRoomOf } from '../shared/office-meetings.js';

const OBJECT_KIND = /^[a-z0-9-]{1,64}$/;
const OBJECT_COLOR = /^[a-z]{1,24}$/;
const OBJECT_FACINGS = new Set(['Up', 'Right', 'Down', 'Left']);
const validObject = (object) => OBJECT_KIND.test(object.kind) && (object.color === undefined || OBJECT_COLOR.test(object.color)) && (object.facing === undefined || OBJECT_FACINGS.has(object.facing)) && !!catalogEntry(object);
const STATUSES = new Set(['available', 'busy', 'away', 'focus']);
const FACINGS = new Set(['north', 'east', 'south', 'west']);
const ROOM_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const MAX_OBJECTS = 250;
const MAX_HISTORY = 100;

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

function validOrigin(origin) {
  if (!origin) return true; // CLI and test clients have no Origin header.
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** A local development server. Identities are session IDs, not authenticated accounts. */
export async function startServer({
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1',
  dataDir = resolve(dirname(fileURLToPath(import.meta.url)), 'data'),
  maxRooms = 50,
  maxParticipants = 32,
} = {}) {
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
  const participants = (room) => [...room.members.values()].map((member) => ({ ...member.participant }));
  const broadcast = (room, payload, predicate = () => true) => {
    for (const member of room.members.values()) if (predicate(member.participant)) send(member.socket, payload);
  };
  /** Meeting rooms: active while someone is inside; a locked room admits nobody new until it empties. */
  const meetingMembers = (room, areaId) => [...room.members.values()].filter((member) => meetingRoomOf(member.participant)?.id === areaId);
  const meetings = (room) => {
    const state = {};
    for (const member of room.members.values()) { const area = meetingRoomOf(member.participant); if (area) (state[area.id] ??= { active: true, locked: false, participants: 0 }).participants += 1; }
    for (const areaId of Object.keys(room.locks)) { if (state[areaId]) state[areaId].locked = true; else delete room.locks[areaId]; }
    return state;
  };
  const systemMessage = (room, areaId, participant, text) => broadcast(room, { type: 'chat', message: { id: randomUUID(), participantId: participant.id, name: participant.name, text, channel: 'meeting', areaId, system: true, createdAt: new Date().toISOString() } }, (other) => meetingRoomOf(other)?.id === areaId);
  const broadcastParticipants = (room) => {
    const before = room.lastMeetings ?? {};
    const state = meetings(room);
    for (const [areaId, meeting] of Object.entries(state)) if (!before[areaId]) for (const member of meetingMembers(room, areaId)) systemMessage(room, areaId, member.participant, 'se unió');
    room.lastMeetings = state;
    broadcast(room, { type: 'participants', participants: participants(room), meetings: state });
  };
  const lockedAgainst = (room, participant, point) => { const area = meetingRoomOf(point); return !!area && !!room.locks[area.id] && meetingRoomOf(participant)?.id !== area.id; };
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
    const room = { slug, members: new Map(), messages: [], objects: [], overrides: {}, areaNames: {}, locks: {}, lastMeetings: {}, writeQueue: Promise.resolve(), loaded: null };
    room.loaded = (async () => {
      try {
        const raw = await readFile(join(dataDir, `${slug}.json`), 'utf8');
        if (raw.length > 256_000) return;
        const saved = JSON.parse(raw);
        if (!Array.isArray(saved.objects)) return;
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
          return [{ id: object.id, kind: object.kind, ...(typeof object.color === 'string' ? { color: object.color } : {}), ...(typeof object.facing === 'string' ? { facing: object.facing } : {}), ...point }];
        });
      } catch (cause) {
        if (cause.code !== 'ENOENT') console.warn(`Could not load objects for room ${slug}: ${cause.message}`);
      }
    })();
    rooms.set(slug, room);
    await room.loaded;
    return room;
  }

  function persistObjects(room, socket) {
    const snapshot = JSON.stringify({ version: 2, objects: room.objects, overrides: room.overrides, areaNames: room.areaNames });
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

  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'open-office', rooms: rooms.size, participants: [...rooms.values()].reduce((sum, room) => sum + room.members.size, 0) }));
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
    if (closing || url.pathname !== '/ws' || !ROOM_SLUG.test(slug) || !validOrigin(request.headers.origin)) {
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
        const room = await getRoom(slug);
        if (!room) return error(socket, 'server_full', 'No rooms are currently available.');
        if (socket.readyState !== WebSocket.OPEN) return;
        if (room.members.size >= maxParticipants) return error(socket, 'room_full', 'This room is full.');
        clearTimeout(joinTimeout);
        client.room = room;
        client.participant = { id: randomUUID(), name: displayName(payload.name) || 'Invitado', color: typeof payload.color === 'string' && COLOR.test(payload.color) ? payload.color : '#7968e6', x: SPAWN.x, y: SPAWN.y, facing: 'south', status: 'available', mic: false, camera: false, screen: false };
        room.members.set(client.participant.id, client);
        send(socket, { type: 'welcome', id: client.participant.id, participants: participants(room), meetings: meetings(room), messages: room.messages, objects: room.objects, overrides: room.overrides, areaNames: room.areaNames });
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
          if (STATUSES.has(payload.status)) { participant.status = payload.status; changed = true; }
          for (const key of ['mic', 'camera', 'screen']) if (typeof payload[key] === 'boolean') { participant[key] = payload[key]; changed = true; }
          if (changed) broadcastParticipants(room);
          break;
        }
        case 'chat': {
          if (!takeToken(client.chatRate, 8, 0.8)) return error(socket, 'chat_rate_limit', 'Wait a moment before sending another message.');
          if (typeof payload.text !== 'string' || !['office', 'nearby', 'meeting'].includes(payload.channel)) return error(socket, 'invalid_chat', 'Choose office, nearby or meeting and provide text.');
          const meetingArea = payload.channel === 'meeting' ? meetingRoomOf(participant) : null;
          if (payload.channel === 'meeting' && !meetingArea) return error(socket, 'invalid_chat', 'Join a meeting room to use its chat.');
          const messageText = payload.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
          if (!messageText || messageText.length > 1000) return error(socket, 'invalid_chat', 'Messages must contain 1 to 1000 characters.');
          const message = { id: randomUUID(), participantId: participant.id, name: participant.name, text: messageText, channel: payload.channel, ...(meetingArea ? { areaId: meetingArea.id } : {}), createdAt: new Date().toISOString() };
          if (message.channel === 'office') {
            room.messages.push(message);
            if (room.messages.length > MAX_HISTORY) room.messages.shift();
          }
          broadcast(room, { type: 'chat', message }, (other) => message.channel === 'office' || (meetingArea ? meetingRoomOf(other)?.id === meetingArea.id : sharesConversationArea(participant, other, CHAT_RADIUS)));
          break;
        }
        case 'area:rename': {
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const area = typeof payload.areaId === 'string' ? meetingRoom(payload.areaId) : null;
          const name = displayName(payload.name);
          if (!area || !name) return error(socket, 'invalid_area', 'Choose a meeting room and a name of 1 to 40 characters.');
          if (name === area.name) delete room.areaNames[area.id]; else room.areaNames[area.id] = name;
          persistObjects(room, socket);
          broadcast(room, { type: 'areas', areaNames: room.areaNames });
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
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          const point = position(payload.x, payload.y);
          if (!point || typeof payload.kind !== 'string' || !validObject(payload)) return error(socket, 'invalid_object', 'Choose a supported object and finite position.');
          if (room.objects.length >= MAX_OBJECTS) return error(socket, 'object_limit', 'This room has reached its object limit.');
          const addedObject = { id: randomUUID(), kind: payload.kind, ...(typeof payload.color === 'string' ? { color: payload.color } : {}), ...(typeof payload.facing === 'string' ? { facing: payload.facing } : {}), ...point };
          const problem = placementProblem(room, addedObject, room.objects);
          if (problem) return error(socket, 'invalid_object', problem);
          room.objects = [...room.objects, addedObject];
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides });
          break;
        }
        case 'object:update': {
          if (!takeToken(client.editRate, 12, 1.2)) return error(socket, 'edit_rate_limit', 'Wait a moment before editing again.');
          if (typeof payload.id !== 'string') return error(socket, 'invalid_object', 'An object ID is required.');
          if (isBaseObjectId(payload.id)) {
            const current = baseAsEditorObject(payload.id, room.overrides);
            const override = { ...(room.overrides[payload.id] ?? {}) };
            delete override.removed;
            if (payload.rotate) { const facing = nextFacing(current); if (facing) override.facing = facing; }
            if (typeof payload.facing === 'string' && OBJECT_FACINGS.has(payload.facing)) override.facing = payload.facing;
            if (payload.x !== undefined || payload.y !== undefined) { const point = position(payload.x, payload.y); if (!point) return error(socket, 'invalid_position', 'Position must contain finite numbers.'); Object.assign(override, point); }
            if (!validOverride(payload.id, override)) return error(socket, 'invalid_object', 'Unsupported variant.');
            if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`${payload.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
            const nextOverrides = { ...room.overrides, [payload.id]: override };
            const problem = placementProblem(room, null, room.objects, nextOverrides);
            if (problem) return error(socket, 'invalid_object', problem);
            room.overrides = nextOverrides;
            persistObjects(room, socket);
            broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides });
            break;
          }
          const index = room.objects.findIndex((object) => object.id === payload.id);
          if (index === -1) return error(socket, 'invalid_object', 'Unknown object.');
          const current = room.objects[index];
          const updated = { ...current };
          if (payload.rotate) { const facing = nextFacing(current); if (facing) updated.facing = facing; }
          if (typeof payload.facing === 'string' && OBJECT_FACINGS.has(payload.facing)) updated.facing = payload.facing;
          if (payload.x !== undefined || payload.y !== undefined) { const point = position(payload.x, payload.y); if (!point) return error(socket, 'invalid_position', 'Position must contain finite numbers.'); Object.assign(updated, point); }
          if (!validObject(updated)) return error(socket, 'invalid_object', 'Unsupported variant.');
          if ([...room.members.values()].some((member) => member.participant.seatId?.startsWith(`object:${current.id}:`))) return error(socket, 'invalid_object', 'Someone is sitting on this object.');
          const others = room.objects.filter((object) => object.id !== current.id);
          const problem = placementProblem(room, updated, others);
          if (problem) return error(socket, 'invalid_object', problem);
          room.objects = [...others.slice(0, index), updated, ...others.slice(index)];
          persistObjects(room, socket);
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides });
          break;
        }
        case 'object:remove': {
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
            broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides });
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
          broadcast(room, { type: 'objects', objects: room.objects, overrides: room.overrides });
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
        ...[...rooms.values()].map((room) => room.writeQueue),
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
