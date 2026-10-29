import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-deploy-'));
  const server = await startServer({ port: 0, dataDir, ...options });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return server;
}
function open(port, headers = {}) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=deploy`, { headers });
  const inbox = [];
  socket.on('message', raw => inbox.push(JSON.parse(raw.toString())));
  return { socket, inbox, ready: new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }),
    send(payload) { socket.send(JSON.stringify(payload)); },
    async next(type) { for (let i = 0; i < 100; i++) { const index = inbox.findIndex(event => event.type === type); if (index >= 0) return inbox.splice(index, 1)[0]; await new Promise(r => setTimeout(r, 20)); } assert.fail(`No ${type}`); } };
}

test('an invite key is required to enter, and only admins decorate when an admin key is set', async t => {
  const server = await fixture(t, { accessKey: 'invite-123', adminKey: 'admin-456' });
  const config = await (await fetch(`http://127.0.0.1:${server.port}/config`)).json();
  assert.deepEqual(config, { accessRequired: true, editPolicy: 'admins', iceServers: [], accounts: 'off' });
  const stranger = open(server.port); await stranger.ready;
  stranger.send({ type: 'join', name: 'Intruso', accessKey: 'wrong' });
  assert.equal((await stranger.next('error')).code, 'access_denied');
  if (stranger.socket.readyState !== WebSocket.CLOSED) await new Promise(resolve => stranger.socket.once('close', resolve));
  const member = open(server.port); await member.ready;
  member.send({ type: 'join', name: 'Ana', accessKey: 'invite-123' });
  assert.equal((await member.next('welcome')).role, 'member');
  member.send({ type: 'object:add', kind: 'plant', x: 900, y: 1200 });
  assert.equal((await member.next('error')).code, 'forbidden');
  member.send({ type: 'chat', channel: 'channel', channelId: 'general', text: 'Members still chat' });
  assert.equal((await member.next('chat')).message.text, 'Members still chat');
  const admin = open(server.port); await admin.ready;
  admin.send({ type: 'join', name: 'Victor', accessKey: 'invite-123', adminKey: 'admin-456' });
  assert.equal((await admin.next('welcome')).role, 'admin');
  admin.send({ type: 'area:rename', areaId: '094907c0', name: 'Sala Vivo' });
  assert.equal((await admin.next('areas')).areaNames['094907c0'], 'Sala Vivo');
});

test('browsers connect from the server host or listed origins, ICE servers come from configuration, and the client is served', async t => {
  const staticDir = await mkdtemp(join(tmpdir(), 'open-office-dist-'));
  t.after(() => rm(staticDir, { recursive: true, force: true }));
  await mkdir(join(staticDir, 'assets'));
  await writeFile(join(staticDir, 'index.html'), '<!doctype html><title>Open Office For All</title>');
  await writeFile(join(staticDir, 'assets', 'app-abcdef12.js'), 'console.log(1)');
  const server = await fixture(t, { staticDir, allowedOrigins: ['https://office.example.org'], iceServers: [{ urls: 'turn:turn.example.org:3478', username: 'u', credential: 'p' }] });
  const base = `http://127.0.0.1:${server.port}`;
  assert.match(await (await fetch(`${base}/`)).text(), /Open Office For All/);
  assert.match(await (await fetch(`${base}/calendar`)).text(), /Open Office For All/, 'client routes fall back to the app');
  const asset = await fetch(`${base}/assets/app-abcdef12.js`);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(`${base}/../../etc/passwd`)).status === 200 ? (await (await fetch(`${base}/../../etc/passwd`)).text()).includes('root:') : false, false, 'no path traversal');
  assert.equal((await fetch(`${base}/missing.png`)).status, 404);
  assert.equal((await (await fetch(`${base}/config`)).json()).iceServers[0].urls, 'turn:turn.example.org:3478');
  const listed = open(server.port, { Origin: 'https://office.example.org' }); await listed.ready; listed.socket.close();
  const foreign = new WebSocket(`ws://127.0.0.1:${server.port}/ws?room=deploy`, { headers: { Origin: 'https://evil.example.com' } });
  await assert.rejects(new Promise((resolve, reject) => { foreign.once('open', resolve); foreign.once('error', reject); }));
});

test('personal accounts: register, sign in, required login and logout', async t => {
  const server = await fixture(t, { accounts: 'required' });
  const base = `http://127.0.0.1:${server.port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (await fetch(`${base}/config`)).json()).accounts, 'required');
  assert.equal((await post('/api/register', { email: 'ana@example.org', password: 'short', name: 'Ana' })).status, 400);
  const registered = await (await post('/api/register', { email: 'Ana@Example.org', password: 'una-clave-larga', name: 'Ana Pérez' })).json();
  assert.equal(registered.user.email, 'ana@example.org');
  assert.equal(registered.token.length, 64);
  assert.equal((await post('/api/register', { email: 'ana@example.org', password: 'otra-clave-larga', name: 'Otra' })).status, 400, 'e-mail already taken');
  assert.equal((await post('/api/login', { email: 'ana@example.org', password: 'mal' })).status, 401);
  const login = await (await post('/api/login', { email: 'ana@example.org', password: 'una-clave-larga' })).json();
  const guest = open(server.port); await guest.ready;
  guest.send({ type: 'join', name: 'Invitado' });
  assert.equal((await guest.next('error')).code, 'login_required');
  const member = open(server.port); await member.ready;
  member.send({ type: 'join', sessionToken: login.token });
  const welcome = await member.next('welcome');
  assert.equal(welcome.participants[0].name, 'Ana Pérez');
  assert.equal(welcome.userId, `acct-${login.user.id}`, 'the account is the identity, on any device');
  assert.equal((await post('/api/logout', { token: login.token })).status, 200);
  assert.equal((await post('/api/me', { token: login.token })).status, 401);
});
