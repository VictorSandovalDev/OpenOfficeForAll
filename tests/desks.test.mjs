import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-desks-'));
  let server = await startServer({ port: 0, dataDir, ...options });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { get port() { return server.port; }, async restart() { await server.close(); server = await startServer({ port: 0, dataDir, ...options }); } };
}

async function connect(port, name, userId) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=desks`);
  const inbox = [];
  const waiters = new Set();
  socket.on('message', raw => { inbox.push(JSON.parse(raw.toString())); for (const resolve of waiters) resolve(); waiters.clear(); });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const client = {
    socket, inbox,
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
  };
  client.send({ type: 'join', name, userId });
  client.welcome = await client.next('welcome');
  return client;
}

const DESK = '900985a6', OTHER_DESK = 'e6db33b1';

test('people claim a free desk, keep one desk each, and the assignment survives a restart', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  assert.deepEqual(ana.welcome.desks, {});
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  ana.send({ type: 'desk:assign', areaId: DESK, userId: 'user-ana-0001' });
  assert.deepEqual((await bruno.next('desks')).desks, { [DESK]: 'user-ana-0001' });
  ana.send({ type: 'desk:assign', areaId: OTHER_DESK, userId: 'user-ana-0001' });
  assert.deepEqual((await bruno.next('desks')).desks, { [OTHER_DESK]: 'user-ana-0001' }, 'moving to another desk frees the first');
  ana.send({ type: 'desk:assign', areaId: 'not-a-desk', userId: 'user-ana-0001' });
  assert.equal((await ana.next('error')).code, 'invalid_desk');
  await server.restart();
  const again = await connect(server.port, 'Bruno', 'user-bruno-001');
  assert.deepEqual(again.welcome.desks, { [OTHER_DESK]: 'user-ana-0001' });
});

test('only editors assign desks to other people or take someone else\'s desk', async t => {
  const server = await fixture(t, { editPolicy: 'admins', adminKey: 'admin-secret-123' });
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  bruno.send({ type: 'desk:assign', areaId: DESK, userId: 'user-ana-0001' });
  assert.equal((await bruno.next('error')).code, 'forbidden', 'members cannot assign desks to others');
  ana.send({ type: 'desk:assign', areaId: DESK, userId: 'user-ana-0001' });
  await bruno.next('desks');
  bruno.send({ type: 'desk:assign', areaId: DESK, userId: null });
  assert.equal((await bruno.next('error')).code, 'forbidden', 'members cannot free someone else\'s desk');
  ana.send({ type: 'desk:assign', areaId: DESK, userId: null });
  assert.deepEqual((await bruno.next('desks')).desks, {}, 'owners can give up their desk');
});

test('alone in a top office you switch to focus; leaving restores your status; your own choice wins', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  const anaId = ana.welcome.id;
  const office = { x: 14.5 * 32, y: 17 * 32 }, hall = { x: 20 * 32, y: 25 * 32 };
  const statusOf = (event, id) => event.participants.find(person => person.id === id)?.status;
  ana.send({ type: 'move', ...office });
  const inside = await bruno.next('participants', event => statusOf(event, anaId) === 'focus');
  assert.equal(inside.participants.find(person => person.id === anaId).focusZone, 'e6db33b1');
  assert.equal(inside.participants.find(person => person.id === anaId).statusBeforeFocus, undefined, 'internal state stays on the server');
  ana.send({ type: 'focus:admit', areaId: 'e6db33b1', participantId: bruno.welcome.id });
  await bruno.next('focus:admitted');
  bruno.send({ type: 'move', x: office.x + 32, y: office.y });
  const both = await ana.next('participants', event => event.participants.some(person => person.id === bruno.welcome.id && person.x === office.x + 32));
  assert.equal(statusOf(both, bruno.welcome.id), 'available', 'the second person is not alone, so stays available');
  ana.send({ type: 'move', ...hall });
  await bruno.next('participants', event => statusOf(event, anaId) === 'available');
  bruno.send({ type: 'move', x: hall.x + 32, y: hall.y });
  await ana.next('participants', event => event.participants.some(person => person.id === bruno.welcome.id && person.x === hall.x + 32));
  ana.send({ type: 'move', ...office });
  await bruno.next('participants', event => statusOf(event, anaId) === 'focus');
  ana.send({ type: 'profile', status: 'available' });
  await bruno.next('participants', event => statusOf(event, anaId) === 'available');
  ana.send({ type: 'move', x: office.x, y: office.y + 32 });
  const stays = await bruno.next('participants', event => event.participants.some(person => person.id === anaId && person.y === office.y + 32));
  assert.equal(statusOf(stays, anaId), 'available', 'a status chosen inside is kept');
});

test('a focus office closes while occupied: others knock and come in only when let in', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  const carla = await connect(server.port, 'Carla', 'user-carla-001');
  const office = { x: 14.5 * 32, y: 17 * 32 }, door = { x: 14.5 * 32, y: 20.5 * 32 };
  ana.send({ type: 'move', ...office });
  const closed = await bruno.next('participants', event => event.focusRooms?.e6db33b1?.occupied);
  assert.equal(closed.focusRooms.e6db33b1.open, false);
  bruno.send({ type: 'move', ...door });
  bruno.send({ type: 'move', ...office });
  assert.equal((await bruno.next('error')).code, 'focus_closed', 'the door is closed');
  bruno.send({ type: 'focus:knock', areaId: 'e6db33b1' });
  const knock = await ana.next('focus:knock');
  assert.deepEqual(knock.from, { id: bruno.welcome.id, name: 'Bruno' });
  carla.send({ type: 'focus:admit', areaId: 'e6db33b1', participantId: carla.welcome.id });
  assert.equal((await carla.next('error')).code, 'invalid_focus', 'only someone inside lets people in');
  ana.send({ type: 'focus:admit', areaId: 'e6db33b1', participantId: bruno.welcome.id });
  assert.equal((await bruno.next('focus:admitted')).by, 'Ana');
  bruno.send({ type: 'move', ...office });
  await ana.next('participants', event => event.participants.some(person => person.id === bruno.welcome.id && person.y === office.y));
  carla.send({ type: 'move', ...office });
  assert.equal((await carla.next('error')).code, 'focus_closed', 'a guest is let in, not everyone');
  ana.send({ type: 'focus:door', areaId: 'e6db33b1', open: true });
  await carla.next('participants', event => event.focusRooms?.e6db33b1?.open === true);
  carla.send({ type: 'move', ...office });
  await ana.next('participants', event => event.participants.some(person => person.id === carla.welcome.id && person.y === office.y));
  for (const client of [ana, bruno, carla]) client.send({ type: 'move', x: 20 * 32, y: 25 * 32 });
  const empty = await ana.next('participants', event => event.participants.every(person => person.y === 25 * 32));
  assert.equal(empty.focusRooms.e6db33b1, undefined, 'an empty office is free again');
});
