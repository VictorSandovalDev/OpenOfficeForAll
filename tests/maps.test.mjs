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
  test(`${id}: the sea cannot be walked on, and every chair, path, plaza, beach and pier is reachable from the lobby`, async () => {
    const { g, m, w } = await load(id);
    const seen = reachable(g, w.SPAWN_TILE);
    for (const seat of g.SEATS) assert.ok(seen.has(`${Math.floor(seat.standX / 32)}/${Math.floor(seat.standY / 32)}`), `${seat.label} is reachable`);
    for (const area of m.AREAS.filter((a) => a.id.startsWith('ground-'))) {
      const tile = `${area.x + Math.floor(area.w / 2)}/${area.y + area.h - 1}`;
      if (area.blocked) assert.ok(!seen.has(tile) || m.AREAS.some((o) => o.depth > area.depth && !o.blocked && tile === `${o.x + 1}/${o.y + o.h - 1}`), `${area.name} stays out of reach`);
      else assert.ok(seen.has(tile), `${area.name} is reachable`);
    }
    const pier = m.AREAS.find((a) => a.name === 'Muelle');
    assert.ok(seen.has(`${pier.x + 1}/${pier.y + pier.h - 1}`), 'the end of the pier is reachable over the water');
    assert.ok(!seen.has(`${pier.x - 3}/${pier.y + pier.h - 1}`), 'but the water beside it is not');
  });
}
