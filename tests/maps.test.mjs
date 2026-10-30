import test from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { resolveSync } from '../server/map-hooks.mjs';

if (!globalThis.__officeMapHooks) { globalThis.__officeMapHooks = true; nodeModule.registerHooks({ resolve: resolveSync }); }
const load = async (id) => ({ g: await import(`../shared/vivo-geometry.js?map=${id}`), m: await import(`../shared/vivo-map.js?map=${id}`), w: await import(`../shared/office-world.js?map=${id}`) });
const reachable = (g, from) => {
  const seen = new Set([`${from.tx}/${from.ty}`]), queue = [[from.tx, from.ty]];
  while (queue.length) { const [x, y] = queue.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx}/${y + dy}`; if (!seen.has(k) && g.canStep(x, y, x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); } } }
  return seen;
};

for (const id of ['studio', 'campus']) {
  test(`${id}: water and roads cannot be walked on, and every chair, path, plaza, crossing and pier is reachable from the lobby`, async () => {
    const { g, m, w } = await load(id);
    const seen = reachable(g, w.SPAWN_TILE);
    for (const seat of g.SEATS) assert.ok(seen.has(`${Math.floor(seat.standX / 32)}/${Math.floor(seat.standY / 32)}`), `${seat.label} is reachable`);
    const openOver = (x, y, depth) => m.AREAS.some((o) => o.depth > depth && !o.blocked && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
    for (const area of m.AREAS.filter((a) => a.id.startsWith('ground-'))) {
      const x = area.x + Math.floor(area.w / 2), y = area.y + area.h - 1;
      if (area.blocked) assert.ok(!seen.has(`${x}/${y}`) || openOver(x, y, area.depth), `${area.name} stays out of reach`);
      else assert.ok(seen.has(`${x}/${y}`), `${area.name} is reachable`);
    }
    // A pier reaches over the water and a zebra crossing over the road; the water or road beside them does not.
    for (const name of ['Muelle', 'Paso de peatones']) {
      const way = m.AREAS.find((a) => a.name === name);
      if (!way) continue;
      assert.ok(seen.has(`${way.x + 1}/${way.y + way.h - 1}`), `the far end of the ${name} is reachable`);
      assert.ok(!seen.has(`${way.x - 3}/${way.y + 1}`), `but beside the ${name} is not`);
    }
  });
}
