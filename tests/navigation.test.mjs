import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCKED, BLOCKED_EDGES, blockedWith, canStand, canStep, findTilePath, nearestFreeTile, tileCenter, tileOf, WORLD } from '../src/navigation.ts';
import { AREAS, OBJECTS } from '../shared/vivo-map.js';
import { SEATS, WALLS, DOORWAYS } from '../shared/vivo-geometry.js';
import { SPAWN_TILE } from '../shared/office-world.js';

const reference = JSON.parse(readFileSync(new URL('../docs/references/vivo/gather-collisions.json', import.meta.url), 'utf8'));

const validate = (start, path, blocked = BLOCKED) => {
  let previous = start;
  for (const tile of path) {
    assert.ok(canStand(tile, blocked), `${tile.tx}/${tile.ty} is free`);
    assert.ok(canStep(previous.tx, previous.ty, tile.tx, tile.ty, blocked), `step ${previous.tx}/${previous.ty} -> ${tile.tx}/${tile.ty} is open`);
    previous = tile;
  }
  return previous;
};

test('the office matches the measured reference: 52×50 tiles, 22 areas, 203 objects, 10 desks', () => {
  assert.deepEqual([WORLD.cols, WORLD.rows], [52, 50]);
  assert.equal(AREAS.length, 22);
  assert.equal(OBJECTS.length, 203);
  assert.equal(OBJECTS.filter(object => object.desk).length, 11);
  assert.equal(AREAS.filter(area => area.type === 'Desk').length, 10);
  assert.equal(AREAS.filter(area => area.type === 'MeetingRoom').map(area => area.name).sort().join(', '), 'Coffee Huddle, Data Huddle, Fishtank Huddle, Media room, Study Huddle');
});

test('collision tiles and wall edges reproduce the reference collision model exactly', () => {
  const tiles = new Set(reference.collisionsMap.map(([tile]) => tile));
  assert.deepEqual([...BLOCKED].sort(), [...tiles].sort());
  const edges = new Set();
  for (const edge of reference.blockedDirections) { const [a, b] = edge.split(':'); edges.add(`${a}:${b}`); edges.add(`${b}:${a}`); }
  assert.deepEqual([...BLOCKED_EDGES].sort(), [...edges].sort());
  assert.equal(WALLS.length, 308);
  assert.equal(WALLS.filter(wall => wall.open).length, 48);
  assert.equal(DOORWAYS.length, 24);
});

test('walls block the edge between tiles while doorways stay open', () => {
  // Media room west wall: the lobby side (28,35) cannot enter (29,35), but the doorway rows 37-38 can.
  assert.equal(canStep(28, 35, 29, 35), false);
  assert.equal(canStep(28, 37, 29, 37), true);
  assert.equal(canStep(28, 38, 29, 38), true);
  // The meeting table blocks its tiles; a diagonal cannot cut a wall corner.
  assert.equal(canStand({ tx: 34, ty: 38 }), false);
  assert.equal(canStep(28, 36, 29, 37), false);
  assert.equal(canStep(100, 100, 101, 100), false);
});

test('tile paths reach every seat exit from the spawn and respect walls and furniture', () => {
  assert.ok(canStand(SPAWN_TILE));
  for (const seat of SEATS) {
    const exit = tileOf({ x: seat.standX, y: seat.standY });
    const path = findTilePath(SPAWN_TILE, exit);
    assert.ok(path.length > 0, `${seat.id} (${seat.label}) must be reachable`);
    assert.deepEqual(validate(SPAWN_TILE, path), exit);
  }
});

test('seat-to-seat routes complete between desks, huddles, the lobby and the garden', () => {
  const sample = SEATS.filter((seat, index) => index % 6 === 0);
  for (const from of sample) for (const seat of SEATS) {
    const start = tileOf({ x: from.standX, y: from.standY }), end = tileOf({ x: seat.standX, y: seat.standY });
    if (start.tx === end.tx && start.ty === end.ty) continue;
    const path = findTilePath(start, end);
    assert.ok(path.length > 0, `${from.id} -> ${seat.id}`);
    assert.deepEqual(validate(start, path), end);
  }
});

test('placed furniture blocks tiles, blocked goals snap to the nearest free tile, and sealed targets fail', () => {
  const blocked = blockedWith([{ id: 'a', kind: 'table', x: tileCenter({ tx: 21, ty: 38 }).x, y: tileCenter({ tx: 21, ty: 38 }).y }]);
  assert.equal(canStand({ tx: 21, ty: 38 }, blocked), false);
  assert.equal(canStand({ tx: 22, ty: 38 }, blocked), false);
  assert.equal(canStand({ tx: 23, ty: 38 }, blocked), true);
  assert.deepEqual(nearestFreeTile({ tx: 21, ty: 38 }, blocked), { tx: 21, ty: 37 });
  const sealed = blockedWith([[19, 39], [21, 39], [20, 38], [20, 40]].map(([tx, ty], i) => ({ id: `p${i}`, kind: 'plant', ...tileCenter({ tx, ty }) })));
  assert.deepEqual(findTilePath({ tx: 20, ty: 39 }, { tx: 20, ty: 42 }, sealed), []);
  assert.deepEqual(findTilePath({ tx: 20, ty: 39 }, { tx: 34, ty: 38 }), [], 'a furniture tile is never a destination');
});
