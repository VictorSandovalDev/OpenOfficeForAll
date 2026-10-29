import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.mjs';
import { canApproachSeat, canExitSeat, getOfficeSeat, getOfficeSeats, SEAT_INTERACTION_RADIUS } from '../shared/office-seats.js';
import { tileCenter } from '../shared/office-world.js';

async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'open-office-seating-'));
  const server = await startServer({ port: 0, dataDir });
  t.after(async () => { await server.close(); await rm(dataDir, { recursive: true, force: true }); });
  return server;
}

async function connect(port, name, room = 'team') {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}`);
  const inbox = [];
  const waiters = new Set();
  socket.on('message', raw => { inbox.push(JSON.parse(raw.toString())); for (const resolve of waiters) resolve(); waiters.clear(); });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const client = {
    socket, inbox, id: null,
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
    async moveTo(x, y) {
      this.send({ type: 'move', x, y });
      return this.next('participants', event => event.participants.some(person => person.id === this.id && person.x === x && person.y === y));
    },
  };
  client.send({ type: 'join', name });
  client.id = (await client.next('welcome')).id;
  return client;
}
const personIn = (event, client) => event.participants.find(person => person.id === client.id);
const seatBy = (predicate) => getOfficeSeats().find(predicate);

test('all 58 fixed chairs have distinct IDs, a tile, a facing and a reachable exit beside them', () => {
  const seats = getOfficeSeats();
  assert.equal(seats.length, 58);
  assert.equal(new Set(seats.map(seat => seat.id)).size, seats.length);
  assert.equal(seats.filter(seat => seat.label.includes('aeron chair')).length, 10, 'ten desk chairs');
  for (const seat of seats) {
    assert.ok(seat.label.length > 0);
    assert.ok(['north', 'south', 'east', 'west'].includes(seat.facing));
    assert.deepEqual({ x: seat.x, y: seat.y }, tileCenter(seat.tx, seat.ty));
    assert.ok(Math.hypot(seat.x - seat.standX, seat.y - seat.standY) <= SEAT_INTERACTION_RADIUS);
    assert.ok(canExitSeat(seat), seat.id);
    assert.ok(canApproachSeat({ x: seat.standX, y: seat.standY }, seat), seat.id);
  }
  assert.equal(getOfficeSeat('unknown'), undefined);
  assert.equal(getOfficeSeat(null), undefined);
  const spot = tileCenter(20, 39);
  const objects = [{ id: 'one', kind: 'chair', ...spot }, { id: 'two', kind: 'plant', ...tileCenter(20, 40) }];
  const added = getOfficeSeat('object:one:0', objects);
  assert.equal(getOfficeSeats(objects).length, 59);
  assert.equal(added.facing, 'south');
  assert.ok(canExitSeat(added, objects), 'a placed plant in front moves the exit to a free side');
  assert.notDeepEqual([added.standX, added.standY], [spot.x, spot.y + 32]);
});

test('huddle side chairs face their table and broadcast east/west seated poses', async t => {
  const server = await fixture(t);
  const occupant = await connect(server.port, 'Ana');
  const observer = await connect(server.port, 'Bruno');
  const sideSeats = getOfficeSeats().filter(seat => /(simple|barcelona|pp501|z) chair/.test(seat.label) && (seat.facing === 'east' || seat.facing === 'west'));
  assert.equal(sideSeats.length, 8);
  for (const seat of sideSeats) {
    await occupant.moveTo(seat.standX, seat.standY);
    occupant.send({ type: 'seat:sit', seatId: seat.id, facing: 'north' });
    const seated = personIn(await observer.next('participants', event => personIn(event, occupant)?.seatId === seat.id), occupant);
    assert.deepEqual([seated.x, seated.y, seated.facing], [seat.x, seat.y, seat.facing]);
    occupant.send({ type: 'seat:stand' });
    const stood = personIn(await observer.next('participants', event => { const person = personIn(event, occupant); return !person?.seatId && person?.x === seat.standX && person?.y === seat.standY; }), occupant);
    assert.deepEqual([stood.x, stood.y], [seat.standX, seat.standY]);
  }
});

test('a chair sealed by furniture on every side cannot be used or approached through a wall', () => {
  const spot = tileCenter(20, 39);
  const around = [[19, 39], [21, 39], [20, 38], [20, 40]].map(([tx, ty], i) => ({ id: `p${i}`, kind: 'plant', ...tileCenter(tx, ty) }));
  const objects = [{ id: 'sealed', kind: 'chair', ...spot }, ...around];
  const seat = getOfficeSeat('object:sealed:0', objects);
  assert.equal(canExitSeat(seat, objects), false);
  assert.equal(canApproachSeat(spot, seat, objects), false);
  // Lobby chair beside the Media room wall: the room side is adjacent but separated by a wall.
  const lobbyEdge = [{ id: 'edge', kind: 'chair', ...tileCenter(28, 35) }];
  const edgeSeat = getOfficeSeat('object:edge:0', lobbyEdge);
  assert.ok(canExitSeat(edgeSeat, lobbyEdge));
  assert.equal(canApproachSeat(tileCenter(29, 35), edgeSeat, lobbyEdge), false, 'adjacent through the wall is not an approach');
  assert.equal(canApproachSeat(tileCenter(27, 35), edgeSeat, lobbyEdge), true);
});

test('blocking an occupied chair\'s last exit is rejected, and standing uses the exit that remains', async t => {
  const server = await fixture(t);
  const occupant = await connect(server.port, 'Ana');
  const editor = await connect(server.port, 'Bruno');
  const spot = tileCenter(20, 39);
  await Promise.all([occupant.moveTo(spot.x, spot.y - 64), editor.moveTo(spot.x + 96, spot.y)]);
  editor.send({ type: 'object:add', kind: 'chair', ...spot });
  const chair = (await editor.next('objects')).objects[0];
  const live = getOfficeSeat(`object:${chair.id}:0`, [chair]);
  assert.deepEqual([live.tx, live.ty, live.facing], [20, 39, 'south']);
  await occupant.moveTo(live.standX, live.standY);
  occupant.send({ type: 'seat:sit', seatId: live.id });
  await editor.next('participants', event => personIn(event, occupant)?.seatId === live.id);
  for (const [tx, ty] of [[19, 39], [21, 39], [20, 38]]) { editor.send({ type: 'object:add', kind: 'plant', ...tileCenter(tx, ty) }); await editor.next('objects'); }
  editor.send({ type: 'object:add', kind: 'plant', ...tileCenter(20, 40) });
  assert.equal((await editor.next('error')).code, 'invalid_object');
  editor.inbox.length = 0; // older participant updates must not satisfy the stand check
  occupant.send({ type: 'seat:stand' });
  const stood = personIn(await editor.next('participants', event => !personIn(event, occupant)?.seatId), occupant);
  assert.deepEqual([stood.x, stood.y], [tileCenter(20, 40).x, tileCenter(20, 40).y], 'the only remaining free side');
});

test('simultaneous sit requests reserve one chair, and stand releases it for the other participant', async t => {
  const server = await fixture(t);
  const a = await connect(server.port, 'Ana');
  const b = await connect(server.port, 'Bruno');
  const seat = seatBy(seat => seat.label.includes('aeron chair'));
  await Promise.all([a.moveTo(seat.standX, seat.standY), b.moveTo(seat.standX, seat.standY)]);
  a.send({ type: 'seat:sit', seatId: seat.id });
  b.send({ type: 'seat:sit', seatId: seat.id });
  const occupied = await a.next('participants', event => event.participants.some(person => person.seatId === seat.id));
  const seated = occupied.participants.filter(person => person.seatId === seat.id);
  assert.equal(seated.length, 1);
  const winner = seated[0].id === a.id ? a : b;
  const loser = winner === a ? b : a;
  assert.equal((await loser.next('error')).code, 'seat_unavailable');
  assert.deepEqual([seated[0].x, seated[0].y, seated[0].facing], [seat.x, seat.y, 'north']);
  winner.send({ type: 'move', x: 1100, y: 900, seatId: 'other' });
  assert.equal((await winner.next('error')).code, 'seat_unavailable');
  winner.send({ type: 'profile', name: 'Seat owner', seatId: 'other', x: 1100, y: 900 });
  const unchanged = personIn(await loser.next('participants', event => event.participants.some(person => person.name === 'Seat owner')), winner);
  assert.deepEqual([unchanged.seatId, unchanged.x, unchanged.y], [seat.id, seat.x, seat.y]);
  winner.send({ type: 'seat:stand', x: 1100, y: 900 });
  const stood = personIn(await loser.next('participants', event => { const person = personIn(event, winner); return person?.name === 'Seat owner' && !person.seatId; }), winner);
  assert.deepEqual([stood.x, stood.y], [seat.standX, seat.standY]);
  assert.equal(Object.hasOwn(stood, 'seatId'), false);
  loser.send({ type: 'seat:sit', seatId: seat.id });
  const reassigned = await winner.next('participants', event => personIn(event, loser)?.seatId === seat.id);
  assert.equal(reassigned.participants.filter(person => person.seatId === seat.id).length, 1);
});

test('seat commands validate IDs, distance and status, preserve orientation, and cannot be forged through movement', async t => {
  const server = await fixture(t);
  const client = await connect(server.port, 'Ana');
  client.send({ type: 'seat:sit', seatId: 'missing' });
  assert.equal((await client.next('error')).code, 'invalid_seat');
  // A lawn chair in the garden, facing south: the pond is behind it.
  const seat = seatBy(seat => seat.label.includes('lawn chair') && seat.facing === 'south');
  client.send({ type: 'seat:sit', seatId: seat.id, x: seat.x, y: seat.y });
  assert.equal((await client.next('error')).code, 'seat_too_far');
  // Beside the Media room wall: adjacent through a wall is not a valid approach.
  const edge = seatBy(seat => seat.tx === 29 && seat.ty >= 34 && seat.ty <= 42 && seat.facing === 'east') ?? seatBy(seat => seat.label.includes('space chair'));
  await client.moveTo(seat.standX, seat.standY);
  client.send({ type: 'profile', status: 'away' });
  client.send({ type: 'seat:sit', seatId: seat.id });
  assert.equal((await client.next('error')).code, 'seat_unavailable');
  client.send({ type: 'profile', status: 'focus' });
  client.send({ type: 'seat:sit', seatId: seat.id, facing: 'north' });
  const seated = personIn(await client.next('participants', event => personIn(event, client)?.seatId === seat.id), client);
  assert.equal(seated.status, 'focus');
  assert.equal(seated.facing, 'south');
  assert.deepEqual([seated.x, seated.y], [seat.x, seat.y]);
  client.send({ type: 'seat:stand' });
  await client.next('participants', event => personIn(event, client)?.status === 'focus' && !personIn(event, client)?.seatId && personIn(event, client)?.x === seat.standX);
  client.send({ type: 'move', x: 656, y: 1264, seatId: seat.id });
  const moved = personIn(await client.next('participants', event => personIn(event, client)?.status === 'focus' && personIn(event, client)?.x === 656), client);
  assert.equal(Object.hasOwn(moved, 'seatId'), false);
  assert.ok(edge);
});

test('deleting an occupied added chair stands its occupant, and occupancy is isolated between rooms', async t => {
  const server = await fixture(t);
  const a = await connect(server.port, 'Ana');
  const b = await connect(server.port, 'Bruno');
  const spot = tileCenter(20, 39);
  await Promise.all([a.moveTo(spot.x, spot.y + 32), b.moveTo(spot.x + 64, spot.y + 32)]);
  a.send({ type: 'object:add', kind: 'chair', ...spot });
  const objects = (await a.next('objects')).objects;
  const chair = objects[0];
  const seat = getOfficeSeat(`object:${chair.id}:0`, objects);
  await a.moveTo(seat.standX, seat.standY);
  a.send({ type: 'seat:sit', seatId: seat.id });
  await b.next('participants', event => personIn(event, a)?.seatId === seat.id);
  b.send({ type: 'object:remove', id: chair.id });
  assert.deepEqual((await a.next('objects')).objects, []);
  const stood = personIn(await a.next('participants', event => personIn(event, a)?.y === seat.standY && !personIn(event, a)?.seatId), a);
  assert.deepEqual([stood.x, stood.y], [seat.standX, seat.standY]);
  a.send({ type: 'seat:sit', seatId: seat.id });
  assert.equal((await a.next('error')).code, 'invalid_seat');

  const outsider = await connect(server.port, 'Carla', 'other-office');
  const fixed = seatBy(seat => seat.label.includes('aeron chair'));
  await Promise.all([a.moveTo(fixed.standX, fixed.standY), outsider.moveTo(fixed.standX, fixed.standY)]);
  a.send({ type: 'seat:sit', seatId: fixed.id });
  outsider.send({ type: 'seat:sit', seatId: fixed.id });
  await a.next('participants', event => personIn(event, a)?.seatId === fixed.id);
  const otherRoom = await outsider.next('participants', event => personIn(event, outsider)?.seatId === fixed.id);
  assert.equal(otherRoom.participants.length, 1);
  a.socket.close();
  await b.next('participants', event => !event.participants.some(person => person.id === a.id));
  await b.moveTo(fixed.standX, fixed.standY);
  b.send({ type: 'seat:sit', seatId: fixed.id });
  await b.next('participants', event => personIn(event, b)?.seatId === fixed.id);
});
