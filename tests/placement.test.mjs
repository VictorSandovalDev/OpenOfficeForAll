import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-placement-'));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return {
    get port() { return server.port; },
    async restart() {
      await server.close();
      server = await startServer({ port: 0, dataDir });
    },
  };
}

async function connect(port, name) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=placement`);
  const inbox = [];
  const waiters = new Set();
  socket.on('message', raw => {
    inbox.push(JSON.parse(raw.toString()));
    for (const resolve of waiters) resolve();
    waiters.clear();
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const client = {
    socket, inbox, id: null, welcome: null,
    send(payload) { socket.send(JSON.stringify(payload)); },
    async next(type, predicate = () => true) {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const index = inbox.findIndex(event => event.type === type && predicate(event));
        if (index >= 0) return inbox.splice(index, 1)[0];
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
          const timer = setTimeout(done, Math.max(1, deadline - Date.now()));
          waiters.add(done);
        });
      }
      assert.fail(`No matching ${type} received`);
    },
    async moveTo(x, y) {
      this.send({ type: 'move', x, y });
      return this.next('participants', event => event.participants.some(person => person.id === this.id && person.x === x && person.y === y));
    },
  };
  client.send({ type: 'join', name });
  client.welcome = await client.next('welcome');
  client.id = client.welcome.id;
  return client;
}

test('placing a plant under yourself is rejected and neither peer receives an object change', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  const peer = await connect(server.port, 'Peer');
  await peer.moveTo(720, 1264);
  editor.send({ type: 'object:add', kind: 'plant', x: 656, y: 1264 });
  assert.equal((await editor.next('error')).code, 'invalid_object');
  // A later room message provides a barrier without relying on a sleep.
  editor.send({ type: 'chat', channel: 'office', text: 'After rejected placement' });
  await peer.next('chat', event => event.message.text === 'After rejected placement');
  assert.equal(editor.inbox.some(event => event.type === 'objects'), false);
  assert.equal(peer.inbox.some(event => event.type === 'objects'), false);
  await editor.moveTo(660, 1268);
});

test('placing a wide table over another standing participant protects its full footprint', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  const peer = await connect(server.port, 'Peer');
  await peer.moveTo(752, 1264);
  // A table covers its own tile and the one to its right, where the peer stands.
  editor.send({ type: 'object:add', kind: 'table', x: 720, y: 1264 });
  assert.equal((await editor.next('error')).code, 'invalid_object');
  peer.send({ type: 'profile', status: 'away' });
  await editor.next('participants', event => event.participants.some(person => person.id === peer.id && person.status === 'away'));
  editor.send({ type: 'object:add', kind: 'plant', x: 752, y: 1264 });
  assert.equal((await editor.next('error')).code, 'invalid_object', 'away participants still occupy standing space');
  peer.send({ type: 'chat', channel: 'office', text: 'Standing space preserved' });
  await editor.next('chat', event => event.message.text === 'Standing space preserved');
  assert.equal(peer.inbox.some(event => event.type === 'objects'), false);
});

test('clear placements broadcast to both peers and persist unchanged across restart', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  const peer = await connect(server.port, 'Peer');
  await peer.moveTo(720, 1264);
  editor.send({ type: 'object:add', kind: 'table', x: 820, y: 800 });
  const first = (await editor.next('objects')).objects;
  assert.deepEqual((await peer.next('objects')).objects, first);
  assert.equal(first.length, 1);
  assert.deepEqual([first[0].kind, first[0].x, first[0].y], ['table', 820, 800]);
  // Preserve the established editor behavior: unrelated static furniture is
  // not added to this narrowly scoped participant-overlap validation.
  editor.send({ type: 'object:add', kind: 'plant', x: 400, y: 300 });
  const saved = (await editor.next('objects')).objects;
  assert.equal(saved.length, 2);
  assert.deepEqual((await peer.next('objects')).objects, saved);
  await server.restart();
  const restored = await connect(server.port, 'Restored');
  assert.deepEqual(restored.welcome.objects, saved);
});

test('catalog objects can be placed with a colour and facing, rotated, moved and rejected when invalid', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  await editor.moveTo(720, 1264);
  editor.send({ type: 'object:add', kind: 'space-chair', color: 'red', facing: 'Left', x: 656, y: 1296 });
  const [chair] = (await editor.next('objects')).objects;
  assert.deepEqual([chair.kind, chair.color, chair.facing, chair.x, chair.y], ['space-chair', 'red', 'Left', 656, 1296]);
  editor.send({ type: 'object:update', id: chair.id, rotate: true });
  assert.equal((await editor.next('objects')).objects[0].facing, 'Up');
  editor.send({ type: 'object:update', id: chair.id, x: 688, y: 1296 });
  assert.equal((await editor.next('objects')).objects[0].x, 688);
  editor.send({ type: 'object:add', kind: 'not-a-thing', x: 656, y: 1296 });
  assert.equal((await editor.next('error')).code, 'invalid_object');
  editor.send({ type: 'object:add', kind: 'office-desk', color: 'white', x: 720, y: 1264 });
  assert.equal((await editor.next('error')).code, 'invalid_object', 'a desk covers the editor\'s own tile');
  editor.send({ type: 'object:update', id: chair.id, facing: 'Down', x: 720, y: 1264 });
  const moved = (await editor.next('objects')).objects[0];
  assert.deepEqual([moved.facing, moved.x, moved.y], ['Down', 720, 1264], 'a chair has no footprint and may share the editor\'s tile');
});

test('base-map objects can be rotated and removed through overrides that persist across restarts', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  // The first desk chair of the reference (an Aeron chair facing Up) only has one facing: rotation is a no-op but valid.
  editor.send({ type: 'object:update', id: '7e0bb940', rotate: true });
  const rotated = await editor.next('objects');
  assert.equal(rotated.overrides['7e0bb940'].facing, 'Right', 'an Aeron chair cycles Up → Right');
  // A space chair of the meeting room cycles to the next facing.
  editor.send({ type: 'object:update', id: 'b34830e2', facing: 'Down' });
  assert.equal((await editor.next('objects')).overrides['b34830e2'].facing, 'Down');
  editor.send({ type: 'object:remove', id: 'extra-laptop-0' });
  const removed = await editor.next('objects');
  assert.deepEqual(removed.overrides['extra-laptop-0'], { removed: true });
  editor.send({ type: 'object:update', id: 'nope', rotate: true });
  assert.equal((await editor.next('error')).code, 'invalid_object');
  await server.restart();
  const restored = await connect(server.port, 'Restored');
  assert.deepEqual(restored.welcome.overrides, removed.overrides);
});

test('a map object can be reset to its exact original placement, as undo does', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  editor.send({ type: 'object:update', id: 'b34830e2', x: 880, y: 1104 });
  const moved = await editor.next('objects');
  assert.ok(moved.overrides.b34830e2, 'the move is stored as an override');
  editor.send({ type: 'object:update', id: 'b34830e2', reset: true });
  const reset = await editor.next('objects');
  assert.equal(reset.overrides.b34830e2, undefined, 'reset removes the override entirely');
});

test('objects can open a website or a note, and only valid ones are kept', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  editor.send({ type: 'object:interaction', id: '489f12f9', interaction: { type: 'link', url: 'https://example.org/board', title: 'Tablero' } });
  const linked = await editor.next('objects');
  assert.deepEqual(linked.interactions['489f12f9'], { type: 'link', url: 'https://example.org/board', title: 'Tablero' });
  editor.send({ type: 'object:interaction', id: '489f12f9', interaction: { type: 'link', url: 'javascript:alert(1)' } });
  assert.equal((await editor.next('error')).code, 'invalid_object', 'only http and https links');
  editor.send({ type: 'object:interaction', id: '489f12f9', interaction: null });
  assert.equal((await editor.next('objects')).interactions['489f12f9'], undefined);
  await server.restart();
  const later = await connect(server.port, 'Later');
  assert.deepEqual(later.welcome.interactions, {});
});

test('objects can be placed and moved off the grid, and drawn at their exact position', async t => {
  const server = await fixture(t);
  const editor = await connect(server.port, 'Editor');
  editor.send({ type: 'object:add', kind: 'plant', x: 413, y: 307, free: true });
  const [plant] = (await editor.next('objects')).objects;
  assert.deepEqual([plant.x, plant.y, plant.free], [413, 307, true]);
  const { asMapObject } = await import('../shared/office-objects.js');
  const snapped = asMapObject({ ...plant, free: false }), exact = asMapObject(plant);
  assert.deepEqual([exact.x - snapped.x, exact.y - snapped.y], [413 - (12 * 32 + 16), 307 - (9 * 32 + 16)], 'drawn at the exact offset from its tile centre');
  editor.send({ type: 'object:update', id: plant.id, x: 432, y: 304 });
  const [moved] = (await editor.next('objects')).objects;
  assert.equal(moved.free, undefined, 'moving on the grid drops the exact placement');
  await server.restart();
  const restored = await connect(server.port, 'Restored');
  assert.deepEqual(restored.welcome.objects, [moved]);
});
