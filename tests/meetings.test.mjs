import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

const MEDIA_ROOM = '094907c0';
const TABLE_SEAT = { id: '9c0332ab:0', standX: 1104, standY: 1296 }; // nearest chair to the Media room's table

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-meetings-'));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { get port() { return server.port; }, async restart() { await server.close(); server = await startServer({ port: 0, dataDir }); } };
}

async function connect(port, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=meetings`);
  const inbox = [];
  const waiters = new Set();
  socket.on('message', raw => { inbox.push(JSON.parse(raw.toString())); for (const resolve of waiters) resolve(); waiters.clear(); });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const client = {
    socket, inbox, id: null, welcome: null,
    send(payload) { socket.send(JSON.stringify(payload)); },
    async next(type, predicate = () => true) {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const index = inbox.findIndex(event => event.type === type && predicate(event));
        if (index >= 0) return inbox.splice(index, 1)[0];
        await new Promise(resolve => { const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); }; const timer = setTimeout(done, Math.max(1, deadline - Date.now())); waiters.add(done); });
      }
      assert.fail(`No matching ${type} received`);
    },
    async moveTo(x, y) { this.send({ type: 'move', x, y }); return this.next('participants', event => event.participants.some(person => person.id === this.id && person.x === x && person.y === y)); },
  };
  client.send({ type: 'join', name });
  client.welcome = await client.next('welcome');
  client.id = client.welcome.id;
  return client;
}

test('a meeting is active while someone is inside; locking it keeps others out until it empties', async t => {
  const server = await fixture(t);
  const host = await connect(server.port, 'Host');
  const guest = await connect(server.port, 'Guest');
  assert.deepEqual(host.welcome.meetings, {}, 'no meeting before anyone enters');
  // Locking from outside is refused.
  host.send({ type: 'meeting:lock', areaId: MEDIA_ROOM, locked: true });
  assert.equal((await host.next('error')).code, 'invalid_meeting');
  // Walking to the table chair and sitting starts the meeting for everyone.
  await host.moveTo(TABLE_SEAT.standX, TABLE_SEAT.standY);
  host.send({ type: 'seat:sit', seatId: TABLE_SEAT.id });
  const started = await guest.next('participants', event => event.meetings?.[MEDIA_ROOM]?.active);
  assert.equal(started.meetings[MEDIA_ROOM].participants, 1);
  assert.equal(started.meetings[MEDIA_ROOM].locked, false);
  // The lock reaches everyone, with a system line in the meeting chat for those inside.
  host.send({ type: 'meeting:lock', areaId: MEDIA_ROOM, locked: true });
  await guest.next('participants', event => event.meetings?.[MEDIA_ROOM]?.locked === true);
  const lockLine = await host.next('chat', event => event.message.system && event.message.text !== 'se unió');
  assert.equal(lockLine.message.channel, 'meeting');
  assert.equal(lockLine.message.text, 'bloqueó la reunión');
  // Outsiders cannot step in, sit inside, or read the meeting chat.
  guest.send({ type: 'move', x: TABLE_SEAT.standX, y: TABLE_SEAT.standY });
  assert.equal((await guest.next('error')).code, 'meeting_locked');
  guest.send({ type: 'seat:sit', seatId: TABLE_SEAT.id });
  assert.equal((await guest.next('error')).code, 'meeting_locked');
  host.send({ type: 'chat', channel: 'meeting', text: 'Solo para la sala' });
  const inside = await host.next('chat', event => event.message.text === 'Solo para la sala');
  assert.equal(inside.message.areaId, MEDIA_ROOM);
  guest.send({ type: 'chat', channel: 'office', text: 'barrier' });
  await guest.next('chat', event => event.message.text === 'barrier');
  assert.equal(guest.inbox.some(event => event.type === 'chat' && event.message.channel === 'meeting'), false);
  // Standing up and leaving ends the meeting and clears the lock.
  host.send({ type: 'seat:stand' });
  await host.next('participants', event => !event.participants.find(person => person.id === host.id).seatId);
  await host.moveTo(656, 1264);
  const ended = await guest.next('participants', event => !event.meetings?.[MEDIA_ROOM]);
  assert.deepEqual(ended.meetings, {});
  await guest.moveTo(TABLE_SEAT.standX, TABLE_SEAT.standY);
});

test('meeting rooms can be renamed and the name survives a restart', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  editor.send({ type: 'area:rename', areaId: MEDIA_ROOM, name: 'Sala Vivo' });
  const renamed = await editor.next('areas');
  assert.equal(renamed.areaNames[MEDIA_ROOM], 'Sala Vivo');
  editor.send({ type: 'area:rename', areaId: 'nope', name: 'x' });
  assert.equal((await editor.next('error')).code, 'invalid_area');
  await server.restart();
  const later = await connect(server.port, 'Later');
  assert.equal(later.welcome.areaNames[MEDIA_ROOM], 'Sala Vivo');
});
