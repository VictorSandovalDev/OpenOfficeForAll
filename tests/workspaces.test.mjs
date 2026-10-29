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
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${server.port}/api/workspaces/diseno-web`)).json(), { slug: 'diseno-web', name: 'Diseño Web', template: 'office' });
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

test('a new workspace comes furnished exactly like the designed office, without its people or chat', async t => {
  const server = await fixture(t);
  const designer = await connect(server.port, 'Ana', 'user-ana-0001', 'mi-oficina');
  designer.send({ type: 'object:add', kind: 'plant', x: 413, y: 307, free: true });
  const [plant] = (await designer.next('objects')).objects;
  designer.send({ type: 'object:remove', id: 'b34830e2' });
  await designer.next('objects', event => event.overrides?.b34830e2?.removed);
  designer.send({ type: 'area:rename', areaId: '094907c0', name: 'Sala grande' });
  await designer.next('areas');
  designer.send({ type: 'chat', channel: 'channel', channelId: 'general', text: 'Solo en Vivo' });
  await designer.next('chat');
  const { slug } = await (await post(server.port, { name: 'Equipo nuevo' })).json();
  const guest = await connect(server.port, 'Bruno', 'user-bruno-001', slug);
  assert.deepEqual(guest.welcome.objects, [plant], 'the placed furniture is copied');
  assert.deepEqual(guest.welcome.overrides, { b34830e2: { removed: true } }, 'removed and moved pieces too');
  assert.equal(guest.welcome.areaNames['094907c0'], 'Sala grande', 'and the room names');
  assert.equal(guest.welcome.messages.some(message => message.text === 'Solo en Vivo'), false, 'the chat stays in its own office');
});

test('a workspace can be renamed from the list, and admins-only offices need the admin key', async t => {
  const open = await fixture(t);
  const { slug } = await (await post(open.port, { name: 'Ventas' })).json();
  const inside = await connect(open.port, 'Ana', 'user-ana-0001', slug);
  const renamed = await fetch(`http://127.0.0.1:${open.port}/api/workspaces/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ventas y marketing' }) });
  assert.deepEqual(await renamed.json(), { slug, name: 'Ventas y marketing' });
  assert.equal((await inside.next('workspace')).workspace.name, 'Ventas y marketing', 'people inside see the new name');
  const strict = await fixture(t, { adminKey: 'admin-secret-123' });
  const created = await (await post(strict.port, { name: 'Dirección' })).json();
  const patch = (body) => fetch(`http://127.0.0.1:${strict.port}/api/workspaces/${created.slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await patch({ name: 'Otro nombre' })).status, 403);
  assert.equal((await patch({ name: 'Otro nombre', admin: 'admin-secret-123' })).status, 200);
});

test('everyone sees the same list of workspaces, and empty ones can be deleted (never the main office)', async t => {
  const server = await fixture(t);
  const list = async () => (await (await fetch(`http://127.0.0.1:${server.port}/api/workspaces`)).json()).workspaces;
  const del = (slug, body = {}) => fetch(`http://127.0.0.1:${server.port}/api/workspaces/${slug}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const { slug } = await (await post(server.port, { name: 'Soporte' })).json();
  assert.deepEqual((await list()).map(item => [item.slug, item.name, item.main]), [['mi-oficina', 'Vivo', true], [slug, 'Soporte', false]]);
  const inside = await connect(server.port, 'Ana', 'user-ana-0001', slug);
  assert.equal((await list()).find(item => item.slug === slug).online, 1);
  assert.equal((await del(slug)).status, 409, 'not while someone is inside');
  inside.socket.close();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal((await del('mi-oficina')).status, 400, 'the main office stays');
  assert.equal((await del(slug)).status, 200);
  assert.deepEqual((await list()).map(item => item.slug), ['mi-oficina']);
});
