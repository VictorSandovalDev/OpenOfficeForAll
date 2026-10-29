import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-chat-'));
  let server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { get port() { return server.port; }, async restart() { await server.close(); server = await startServer({ port: 0, dataDir }); } };
}

async function connect(port, name, userId) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=chat`);
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

test('offices start with #general and #social; channels can be created and keep their history across restarts', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  assert.deepEqual(ana.welcome.channels.map(channel => channel.id), ['general', 'social']);
  assert.equal(ana.welcome.userId, 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  ana.send({ type: 'channel:create', name: 'Diseño Web', topic: 'Todo sobre la web' });
  const created = await bruno.next('channels');
  assert.equal(created.created, 'diseno-web');
  assert.equal(created.channels.find(channel => channel.id === 'diseno-web').name, 'diseño-web', 'the visible name keeps the ñ');
  ana.send({ type: 'channel:create', name: 'diseño web' });
  assert.equal((await ana.next('error')).code, 'invalid_channel');
  ana.send({ type: 'chat', channel: 'channel', channelId: 'diseno-web', text: '**Hola** equipo' });
  const message = await bruno.next('chat');
  assert.equal(message.message.channelId, 'diseno-web');
  assert.equal(message.message.userId, 'user-ana-0001');
  ana.send({ type: 'chat', channel: 'channel', channelId: 'no-existe', text: 'x' });
  assert.equal((await ana.next('error')).code, 'invalid_chat');
  await server.restart();
  const later = await connect(server.port, 'Carla', 'user-carla-01');
  assert.ok(later.welcome.channels.some(channel => channel.id === 'diseno-web' && channel.topic === 'Todo sobre la web'));
  assert.deepEqual(later.welcome.messages.map(entry => entry.text), ['**Hola** equipo']);
  assert.ok(later.welcome.users.some(user => user.userId === 'user-bruno-001' && user.name === 'Bruno'), 'people stay in the directory for direct messages');
});

test('direct messages reach only their two people, also after reconnecting', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  const carla = await connect(server.port, 'Carla', 'user-carla-01');
  ana.send({ type: 'chat', channel: 'dm', to: 'user-bruno-001', text: 'Solo para ti' });
  const received = await bruno.next('chat');
  assert.equal(received.message.channel, 'dm');
  assert.equal(received.message.dmKey, 'dm:user-ana-0001:user-bruno-001');
  await ana.next('chat', event => event.message.text === 'Solo para ti');
  ana.send({ type: 'chat', channel: 'channel', channelId: 'general', text: 'barrera' });
  await carla.next('chat', event => event.message.text === 'barrera');
  assert.equal(carla.inbox.some(event => event.type === 'chat' && event.message.channel === 'dm'), false);
  ana.send({ type: 'chat', channel: 'dm', to: 'nobody-here-123', text: 'x' });
  assert.equal((await ana.next('error')).code, 'invalid_chat');
  bruno.socket.close();
  const again = await connect(server.port, 'Bruno', 'user-bruno-001');
  assert.ok(again.welcome.messages.some(entry => entry.text === 'Solo para ti'));
  const outsider = await connect(server.port, 'Dani', 'user-dani-0001');
  assert.equal(outsider.welcome.messages.some(entry => entry.text === 'Solo para ti'), false);
});

test('scheduled meetings are shared, tied to a room, validated, cancellable by their organizer and persisted', async t => {
  const server = await fixture(t);
  const ana = await connect(server.port, 'Ana', 'user-ana-0001');
  const bruno = await connect(server.port, 'Bruno', 'user-bruno-001');
  const start = new Date(Date.now() + 3_600_000).toISOString(), end = new Date(Date.now() + 7_200_000).toISOString();
  ana.send({ type: 'event:create', title: 'Planeación semanal', start, end, areaId: '094907c0', description: 'Revisar la hoja de ruta' });
  const created = await bruno.next('events');
  const event = created.events.find(candidate => candidate.id === created.created);
  assert.equal(event.title, 'Planeación semanal');
  assert.equal(event.areaId, '094907c0');
  assert.equal(event.organizer, 'Ana');
  ana.send({ type: 'event:create', title: 'Al revés', start: end, end: start });
  assert.equal((await ana.next('error')).code, 'invalid_event');
  bruno.send({ type: 'event:delete', id: event.id });
  assert.equal((await bruno.next('error')).code, 'invalid_event', 'only the organizer cancels');
  await server.restart();
  const later = await connect(server.port, 'Ana', 'user-ana-0001');
  assert.equal(later.welcome.events.length, 1);
  later.send({ type: 'event:delete', id: event.id });
  assert.deepEqual((await later.next('events')).events, []);
});
