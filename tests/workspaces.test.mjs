import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-ws-'));
  let server = await startServer({ port: 0, dataDir, ...options });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return { get port() { return server.port; }, async restart() { await server.close(); server = await startServer({ port: 0, dataDir, ...options }); } };
}

async function connect(port, name, userId, room = 'desks') {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`);
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

const post = (port, body) => fetch(`http://127.0.0.1:${port}/api/workspaces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('workspaces get a name, a unique address and their own map; the name can be changed', async t => {
  const server = await fixture(t);
  const created = await post(server.port, { name: 'Diseño Web' });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { slug: 'diseno-web', name: 'Diseño Web' });
  assert.equal((await (await post(server.port, { name: 'Diseño web' })).json()).slug, 'diseno-web-2', 'the same name gets its own address');
  assert.equal((await post(server.port, { name: 'x' })).status, 400);
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${server.port}/api/workspaces/diseno-web`)).json(), { slug: 'diseno-web', name: 'Diseño Web' });
  assert.equal((await (await fetch(`http://127.0.0.1:${server.port}/api/workspaces/mi-oficina`)).json()).name, 'Vivo', 'the original office keeps its name');
  const ana = await connect(server.port, 'Ana', 'user-ana-0001', 'diseno-web');
  assert.deepEqual(ana.welcome.workspace, { slug: 'diseno-web', name: 'Diseño Web' });
  ana.send({ type: 'workspace:rename', name: 'Equipo de diseño' });
  assert.equal((await ana.next('workspace')).workspace.name, 'Equipo de diseño');
  await server.restart();
  const again = await connect(server.port, 'Ana', 'user-ana-0001', 'diseno-web');
  assert.equal(again.welcome.workspace.name, 'Equipo de diseño', 'the new name is kept');
});

test('an empty workspace starts with every piece of furniture removed', async t => {
  const server = await fixture(t);
  const { slug } = await (await post(server.port, { name: 'Oficina vacía', template: 'empty' })).json();
  const ana = await connect(server.port, 'Ana', 'user-ana-0001', slug);
  const overrides = Object.values(ana.welcome.overrides ?? {});
  assert.ok(overrides.length > 100 && overrides.every(override => override.removed === true));
  const full = await connect(server.port, 'Bruno', 'user-bruno-001', (await (await post(server.port, { name: 'Oficina completa' })).json()).slug);
  assert.deepEqual(full.welcome.overrides ?? {}, {}, 'the office template keeps the furniture');
});

test('with an invite key, creating a workspace needs the key', async t => {
  const server = await fixture(t, { accessKey: 'invite-secret-123' });
  assert.equal((await post(server.port, { name: 'Sin clave' })).status, 403);
  assert.equal((await post(server.port, { name: 'Con clave', key: 'invite-secret-123' })).status, 201);
});
