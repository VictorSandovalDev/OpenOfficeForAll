import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { canConnect, startServer } from '../server/index.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-test-'));
  const server = await startServer({ port: 0, dataDir, ...options });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { ...server, dataDir };
}

async function client(port, room = 'team') {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`);
  const inbox = [];
  const waiters = new Set();
  socket.on('message', (raw) => {
    const payload = JSON.parse(raw.toString());
    inbox.push(payload);
    for (const resolve of waiters) resolve();
    waiters.clear();
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  return {
    socket,
    inbox,
    send(payload) { socket.send(JSON.stringify(payload)); },
    async next(type, predicate = () => true, timeout = 1500) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const index = inbox.findIndex((item) => item.type === type && predicate(item));
        if (index !== -1) return inbox.splice(index, 1)[0];
        await new Promise((resolve) => {
          const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
          const timer = setTimeout(done, Math.max(1, deadline - Date.now()));
          waiters.add(done);
        });
      }
      assert.fail(`No ${type} message received within ${timeout}ms`);
    },
    async join(name = 'Ana') {
      this.send({ type: 'join', name, color: '#7867ee' });
      return this.next('welcome');
    },
  };
}

test('health, server IDs, bounded movement, profiles, and clean disconnect', async (t) => {
  const server = await fixture(t);
  const response = await fetch(`http://127.0.0.1:${server.port}/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  const a = await client(server.port);
  a.send({ type: 'join', id: 'forged-id', name: 'Ana', color: '#112233', x: 1, mic: true });
  const welcomeA = await a.next('welcome');
  assert.notEqual(welcomeA.id, 'forged-id');
  assert.deepEqual(welcomeA.participants, [{ id: welcomeA.id, userId: welcomeA.id, role: 'member', name: 'Ana', color: '#112233', x: 656, y: 1264, facing: 'south', status: 'available', mic: false, camera: false, screen: false }]);
  const b = await client(server.port);
  const welcomeB = await b.join('Bruno');
  assert.equal(welcomeB.participants.length, 2);
  a.send({ type: 'move', id: welcomeB.id, x: -100, y: 50_000 });
  const moved = await b.next('participants', (event) => event.participants.some((p) => p.id === welcomeA.id && p.x === 0));
  assert.equal(moved.participants.find((p) => p.id === welcomeA.id).y, 1600);
  assert.equal(moved.participants.find((p) => p.id === welcomeA.id).facing, 'west');
  assert.equal(moved.participants.find((p) => p.id === welcomeB.id).x, 656);
  a.send({ type: 'profile', id: welcomeB.id, name: 'Ana María', status: 'focus', mic: true, camera: true, screen: false });
  const profile = await b.next('participants', (event) => event.participants.some((p) => p.name === 'Ana María'));
  assert.equal(profile.participants.find((p) => p.id === welcomeA.id).status, 'focus');
  assert.equal(profile.participants.find((p) => p.id === welcomeB.id).name, 'Bruno');
  a.socket.close();
  const remaining = await b.next('participants', (event) => event.participants.length === 1);
  assert.equal(remaining.participants[0].id, welcomeB.id);
});

test('movement broadcasts directional facing and validates stationary turns', async (t) => {
  const server = await fixture(t);
  const a = await client(server.port);
  const b = await client(server.port);
  const { id } = await a.join('Ana');
  await b.join('Bruno');
  for (const [x, y, facing] of [[720, 1264, 'east'], [720, 1200, 'north'], [688, 1210, 'west'], [688, 1264, 'south']]) {
    a.send({ type: 'move', x, y });
    const event = await b.next('participants', (event) => event.participants.some((p) => p.id === id && p.x === x && p.y === y && p.facing === facing));
    assert.equal(event.participants.find((p) => p.id === id).facing, facing);
  }
  // No displacement retains orientation; a validated turn can change it.
  a.send({ type: 'move', x: 688, y: 1264, facing: 'invalid' });
  const unchanged = await b.next('participants', (event) => event.participants.some((p) => p.id === id && p.x === 688 && p.y === 1264));
  assert.equal(unchanged.participants.find((p) => p.id === id).facing, 'south');
  a.send({ type: 'move', x: 688, y: 1264, facing: 'north' });
  await b.next('participants', (event) => event.participants.some((p) => p.id === id && p.facing === 'north' && p.y === 1264));
});

test('meeting rooms are acoustically closed and proximity applies elsewhere', () => {
  const available = (x, y) => ({ x, y, status: 'available' });
  const inside = available(1000, 1150); // Media room, tile 31/35
  assert.equal(canConnect(inside, available(1250, 1350)), true, 'far corner of the same room');
  assert.equal(canConnect(inside, available(900, 1150)), false, 'lobby side of the shared wall');
  assert.equal(canConnect(inside, available(1000, 1070)), false, 'public area above the room');
  assert.equal(canConnect(available(300, 700), available(300, 1000)), false, 'two different huddles');
  assert.equal(canConnect(available(500, 700), available(720, 700)), true);
  assert.equal(canConnect(available(500, 700), available(721, 700)), false);
});
test('room and nearby chat isolation, authoritative sender, office-only history', async (t) => {
  const server = await fixture(t);
  const a = await client(server.port);
  const b = await client(server.port);
  const outsider = await client(server.port, 'other-team');
  const welcomeA = await a.join('Ana');
  await b.join('Bruno');
  await outsider.join('Carla');
  a.send({ type: 'chat', text: 'Hola oficina', channel: 'office', participantId: 'spoof', name: 'Spoof' });
  const received = await b.next('chat');
  assert.equal(received.message.participantId, welcomeA.id);
  assert.equal(received.message.name, 'Ana');
  assert.equal(received.message.text, 'Hola oficina');
  b.send({ type: 'move', x: 1400, y: 700 });
  await b.next('participants', (event) => event.participants.some((p) => p.name === 'Bruno' && p.x === 1400));
  a.send({ type: 'chat', text: 'Solo cerca', channel: 'nearby' });
  await a.next('chat', (event) => event.message.text === 'Solo cerca');
  // A subsequent office message is a barrier: all preceding frames were handled.
  a.send({ type: 'chat', text: 'Barrera', channel: 'office' });
  await b.next('chat', (event) => event.message.text === 'Barrera');
  assert.equal(b.inbox.some((event) => event.type === 'chat' && event.message.text === 'Solo cerca'), false);
  outsider.send({ type: 'chat', text: 'Otro equipo', channel: 'office' });
  await outsider.next('chat', (event) => event.message.text === 'Otro equipo');
  assert.equal(outsider.inbox.some((event) => event.type === 'chat'), false);
  const newcomer = await client(server.port);
  const welcome = await newcomer.join('Dani');
  assert.deepEqual(welcome.messages.map((message) => message.text), ['Hola oficina', 'Barrera']);
  b.send({ type: 'move', x: 700, y: 1264 });
  await a.next('participants', (event) => event.participants.some((p) => p.name === 'Bruno' && p.x === 700));
  a.send({ type: 'chat', text: 'Ahora cerca', channel: 'nearby' });
  assert.equal((await b.next('chat', (event) => event.message.text === 'Ahora cerca')).message.channel, 'nearby');
});

test('invalid messages do not crash and cannot mutate other participants', async (t) => {
  const server = await fixture(t);
  const a = await client(server.port);
  a.socket.send('{broken json');
  assert.equal((await a.next('error')).code, 'invalid_json');
  a.send({ type: 'move', x: 10, y: 20 });
  assert.equal((await a.next('error')).code, 'join_required');
  const welcome = await a.join();
  a.send({ type: 'move', x: '10', y: 20 });
  assert.equal((await a.next('error')).code, 'invalid_position');
  a.send({ type: 'chat', text: 'Hello', channel: 'invalid' });
  assert.equal((await a.next('error')).code, 'invalid_chat');
  a.send({ type: 'join', name: 'Second identity' });
  assert.equal((await a.next('error')).code, 'already_joined');
  a.send({ type: 'profile', id: 'new-id', x: 123, name: 'Still here' });
  const event = await a.next('participants', (event) => event.participants[0]?.name === 'Still here');
  assert.equal(event.participants[0].id, welcome.id);
  assert.equal(event.participants[0].x, 656);
});

test('WebRTC signals require same room and proximity or shared meeting zone', async (t) => {
  const server = await fixture(t);
  const a = await client(server.port);
  const b = await client(server.port);
  const outsider = await client(server.port, 'private');
  const welcomeA = await a.join('Ana');
  const welcomeB = await b.join('Bruno');
  const welcomeOutsider = await outsider.join('Carla');
  a.send({ type: 'signal', to: welcomeB.id, from: 'forged', data: { description: { type: 'offer', sdp: 'test' } } });
  assert.equal((await b.next('signal')).from, welcomeA.id);
  a.send({ type: 'signal', to: welcomeOutsider.id, data: { candidate: 'test' } });
  assert.equal((await a.next('error')).code, 'peer_unavailable');
  b.send({ type: 'move', x: 1500, y: 400 });
  await a.next('participants', (event) => event.participants.some((p) => p.id === welcomeB.id && p.x === 1500));
  a.send({ type: 'signal', to: welcomeB.id, data: { candidate: 'test' } });
  assert.equal((await a.next('error')).code, 'peer_unavailable');
  a.send({ type: 'move', x: 1000, y: 1150 });
  b.send({ type: 'move', x: 1250, y: 1350 });
  await a.next('participants', (event) => event.participants.some((p) => p.id === welcomeA.id && p.y === 1150) && event.participants.some((p) => p.id === welcomeB.id && p.y === 1350));
  a.send({ type: 'signal', to: welcomeB.id, data: { candidate: 'meeting-room' } });
  assert.equal((await b.next('signal')).data.candidate, 'meeting-room');
});

test('meeting room boundary isolates nearby chat and media; unavailable statuses block signals', async (t) => {
  const server = await fixture(t);
  const inside = await client(server.port);
  const outside = await client(server.port);
  const farInside = await client(server.port);
  const insideId = (await inside.join('Inside')).id;
  const outsideId = (await outside.join('Outside')).id;
  const farInsideId = (await farInside.join('Far inside')).id;
  inside.send({ type: 'move', x: 1000, y: 1150 });
  outside.send({ type: 'move', x: 900, y: 1150 });
  farInside.send({ type: 'move', x: 1250, y: 1350 });
  await inside.next('participants', (event) => {
    const byId = new Map(event.participants.map((p) => [p.id, p]));
    return byId.get(insideId)?.x === 1000 && byId.get(outsideId)?.x === 900 && byId.get(farInsideId)?.x === 1250;
  });
  inside.send({ type: 'signal', to: outsideId, data: { candidate: 'cross-boundary' } });
  assert.equal((await inside.next('error')).code, 'peer_unavailable');
  outside.send({ type: 'signal', to: insideId, data: { candidate: 'reverse-boundary' } });
  assert.equal((await outside.next('error')).code, 'peer_unavailable');
  inside.send({ type: 'chat', channel: 'nearby', text: 'Meeting only' });
  assert.equal((await farInside.next('chat')).message.text, 'Meeting only');
  inside.send({ type: 'chat', channel: 'office', text: 'Barrier one' });
  await outside.next('chat', (event) => event.message.text === 'Barrier one');
  assert.equal(outside.inbox.some((event) => event.type === 'chat'), false);
  outside.send({ type: 'chat', channel: 'nearby', text: 'Outside only' });
  await outside.next('chat', (event) => event.message.text === 'Outside only');
  outside.send({ type: 'chat', channel: 'office', text: 'Barrier two' });
  await inside.next('chat', (event) => event.message.text === 'Barrier two');
  assert.equal(inside.inbox.some((event) => event.type === 'chat' && event.message.text === 'Outside only'), false);
  inside.send({ type: 'profile', status: 'busy' });
  inside.send({ type: 'signal', to: farInsideId, data: { candidate: 'busy-sender' } });
  assert.equal((await inside.next('error')).code, 'peer_unavailable');
  farInside.send({ type: 'signal', to: insideId, data: { candidate: 'busy-recipient' } });
  assert.equal((await farInside.next('error')).code, 'peer_unavailable');
  inside.send({ type: 'profile', status: 'available' });
  inside.send({ type: 'signal', to: farInsideId, data: { candidate: 'available-again' } });
  assert.equal((await farInside.next('signal')).data.candidate, 'available-again');
  farInside.send({ type: 'profile', status: 'focus' });
  await inside.next('participants', (event) => event.participants.some((p) => p.id === farInsideId && p.status === 'focus'));
  inside.send({ type: 'signal', to: farInsideId, data: { candidate: 'focus-recipient' } });
  assert.equal((await inside.next('error')).code, 'peer_unavailable');
});

test('objects synchronize, stay inside their room, and persist across server restarts', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-persistence-test-'));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  const a = await client(server.port);
  const b = await client(server.port);
  await a.join('Ana');
  await b.join('Bruno');
  a.send({ type: 'object:add', id: 'forged-object', kind: 'plant', x: 400, y: 300 });
  const objects = (await b.next('objects')).objects;
  assert.equal(objects.length, 1);
  assert.notEqual(objects[0].id, 'forged-object');
  assert.equal(objects[0].kind, 'plant');
  const outsider = await client(server.port, 'other');
  assert.deepEqual((await outsider.join()).objects, []);
  await server.close();
  server = await startServer({ port: 0, dataDir });
  const restored = await client(server.port);
  assert.deepEqual((await restored.join()).objects, objects);
  restored.send({ type: 'object:remove', id: objects[0].id });
  assert.deepEqual((await restored.next('objects')).objects, []);
});

test('foreign browser origins and invalid room slugs are rejected', async (t) => {
  const server = await fixture(t);
  for (const [room, origin] of [['team', 'https://untrusted.example'], ['..%2Foutside', 'http://localhost:5173']]) {
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws?room=${room}`, { origin });
    const message = await new Promise((resolve) => socket.once('error', (error) => resolve(error.message)));
    assert.match(message, /403/);
  }
});

test('avatar looks and status texts are validated and shared with everyone', async (t) => {
  const server = await fixture(t);
  const a = await client(server.port);
  a.send({ type: 'join', name: 'Ana', avatar: { skin: 4, hair: 99, top: 2, bottom: -1, shoes: 'x', glasses: 3, hat: 1 } });
  const welcome = await a.next('welcome');
  assert.deepEqual(welcome.participants[0].avatar, { skin: 4, hair: 1, top: 2, bottom: 0, shoes: 0, glasses: 3, hat: 1 });
  const b = await client(server.port);
  await b.join('Bruno');
  a.send({ type: 'profile', avatar: { skin: 0, hair: 4, top: 5, bottom: 3, shoes: 2, glasses: 0, hat: 0 }, statusText: '  En una llamada  ' });
  const update = await b.next('participants', (event) => event.participants.some((p) => p.name === 'Ana' && p.avatar?.hair === 4));
  const ana = update.participants.find((p) => p.name === 'Ana');
  assert.equal(ana.statusText, 'En una llamada');
  assert.equal(ana.avatar.top, 5);
});
