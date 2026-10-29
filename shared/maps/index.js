import * as vivo from './vivo.js';
import { composeMap } from './compose.js';

/** Office maps. Studio and Campus reuse Vivo's own rooms and furniture, then add their own grounds: stone paths,
    a plaza, gardens and a beach by the sea. Every outdoor piece is listed as [kind, colour, tile x, tile y]. */

const ground = (name, floor, floorColor, x, y, w, h, extra = {}) => ({ name, floor, floorColor, x, y, w, h, ...extra });
const path = (x, y, w, h) => ground('Camino', 'StonePath', 'Grey', x, y, w, h);
/** Sand, a frothy shore line, shallow and deep water from row `top` down to the bottom of the map. */
const beach = (cols, top, rows) => [
  ground('Playa', 'Sand', 'Beige', 0, top, cols, rows - top - 7),
  ground('Orilla', 'Shore', 'Foam', 0, rows - 7, cols, 1, { blocked: true }),
  ground('Mar', 'Water', 'Shallow', 0, rows - 6, cols, 3, { blocked: true }),
  ground('Mar abierto', 'Water', 'Deep', 0, rows - 3, cols, 3, { blocked: true }),
];
const every = (from, to, step, make) => { const out = []; for (let v = from; v <= to; v += step) out.push(...make(v)); return out; };
/** An umbrella with two loungers and a towel beside it, standing on the tile (x, y). */
const sunSpot = (x, y, color) => [['beach-umbrella', color, x, y], ['sun-lounger', 'white', x - 1, y + 2], ['sun-lounger', 'white', x + 1, y + 2], ['beach-towel', 'yellow', x + 3, y + 2]];

// ---------------------------------------------------------------------------------------------------------------
// Studio: the lobby, the team hall and the media room by the sea, with a garden walk down to the beach.
const STUDIO_COLS = 40, STUDIO_ROWS = 52, SAND = 38;
const studio = composeMap(vivo, {
  cols: STUDIO_COLS, rows: STUDIO_ROWS, spawn: { tx: 10, ty: 27 },
  stamps: [
    { rect: { x: 13, y: 20, w: 27, h: 23 }, dx: -10, dy: -12 }, // lobby, main hall with six desks, kitchen, lounge and media room
    { rect: { x: 22, y: 11, w: 7, h: 7 }, dx: -10, dy: -11 }, // the koi pond behind the hall
  ],
  areas: [
    path(10, 31, 2, 4), // from the lobby door
    path(2, 34, 36, 2), // the promenade
    path(32, 8, 2, 26), // along the east side of the building
    path(15, 6, 2, 2), // from the hall's garden door to the pond
    ground('Plaza', 'StonePath', 'Grey', 31, 2, 8, 6),
    path(18, 36, 3, 2), // down to the sand
    ...beach(STUDIO_COLS, SAND, STUDIO_ROWS),
    ground('Muelle', 'WoodSlats', 'Wood', 30, STUDIO_ROWS - 7, 3, 6, { depth: 3 }),
  ],
  objects: [
    // Garden along the promenade: hedges with gaps, flower beds, benches and lamps.
    ['hedge', 'green', 2, 32], ['hedge', 'green', 4, 32], ['flower-bed', 'pink', 6, 32], ['hedge', 'green', 13, 32], ['flower-bed', 'pink', 15, 32], ['hedge', 'green', 17, 32], ['hedge', 'green', 22, 32], ['flower-bed', 'pink', 24, 32], ['hedge', 'green', 26, 32], ['hedge', 'green', 28, 32],
    ['park-bench', 'wood', 5, 36], ['park-bench', 'wood', 23, 36], ['park-bench', 'wood', 33, 36],
    ...[3, 14, 22, 30, 37].map((x) => ['street-lamp', 'black', x, 33]),
    // The plaza with a fountain, benches and palms.
    ['fountain', 'stone', 34, 3], ['park-bench', 'wood', 31, 2], ['park-bench', 'wood', 36, 2],
    ['palm-tree-short', 'green', 38, 3], ['palm-tree-short', 'green', 38, 7], ['flower-bed', 'pink', 31, 7],
    // Trees around the building.
    ['pine-tree-small', 'green', 1, 10], ['pine-tree-large', 'green', 1, 18], ['maple-tree', 'lightgreen', 1, 25], ['birch-tree', 'lightgreen', 36, 14], ['pine-tree-small', 'green', 37, 21], ['maple-tree', 'green', 36, 28],
    ['pine-tree-small', 'green', 5, 2], ['birch-tree', 'lightgreen', 24, 3], ['pine-tree-large', 'green', 28, 1],
    // The beach: palms, umbrellas, loungers and the fun bits.
    ...every(2, 37, 7, (x) => [['palm-tree', 'green', x, SAND]]),
    ...sunSpot(5, SAND + 2, 'red'), ...sunSpot(14, SAND + 3, 'blue'), ...sunSpot(23, SAND + 2, 'red'),
    ['lifeguard-tower', 'white', 35, SAND + 2], ['surfboard', 'white', 28, SAND + 4], ['surfboard', 'white', 29, SAND + 4],
    ['sandcastle', 'sand', 11, SAND + 5], ['beach-ball', 'red', 20, SAND + 5], ['beach-rocks', 'grey', 1, SAND + 5], ['beach-rocks', 'grey', 38, SAND + 5],
    ['rowboat', 'wood', 33, SAND + 3],
  ],
});

// ---------------------------------------------------------------------------------------------------------------
// Campus: two buildings joined by a promenade and a fountain plaza, gardens in between and a long beach.
const CAMPUS_COLS = 92, CAMPUS_ROWS = 72, CAMPUS_SAND = 58;
const campus = composeMap(vivo, {
  cols: CAMPUS_COLS, rows: CAMPUS_ROWS, spawn: { tx: 20, ty: 39 },
  stamps: [
    { rect: { x: 0, y: 0, w: 46, h: 44 } }, // the whole office
    { rect: { x: 6, y: 0, w: 46, h: 44 }, dx: 40, suffix: '-b', label: '2' }, // and a second building beside it
  ],
  areas: [
    path(20, 43, 2, 5), path(60, 43, 2, 5), // from each lobby door
    path(4, 47, 84, 2), // the promenade joining both buildings
    path(44, 8, 3, 39), // the garden alley between the buildings, up to the northern walk
    path(24, 8, 44, 2), // the northern walk past both koi ponds
    ground('Plaza', 'StonePath', 'Grey', 39, 49, 14, 7),
    path(44, 56, 3, 2), // down to the sand
    ...beach(CAMPUS_COLS, CAMPUS_SAND, CAMPUS_ROWS),
    ground('Muelle', 'WoodSlats', 'Wood', 72, CAMPUS_ROWS - 7, 3, 6, { depth: 3 }),
    ground('Muelle', 'WoodSlats', 'Wood', 16, CAMPUS_ROWS - 7, 3, 6, { depth: 3 }),
  ],
  objects: [
    // Hedges and flower beds along the promenade, open in front of the doors, the alley and the plaza.
    ...every(4, 36, 4, (x) => (x >= 18 && x <= 22 ? [] : [[x % 8 === 0 ? 'flower-bed' : 'hedge', x % 8 === 0 ? 'pink' : 'green', x, 45]])),
    ...every(52, 84, 4, (x) => (x >= 58 && x <= 62 ? [] : [[x % 8 === 0 ? 'flower-bed' : 'hedge', x % 8 === 0 ? 'pink' : 'green', x, 45]])),
    ...every(6, 34, 7, (x) => [['street-lamp', 'black', x, 49]]), ...every(56, 86, 7, (x) => [['street-lamp', 'black', x, 49]]),
    ['park-bench', 'wood', 10, 50], ['park-bench', 'wood', 28, 50], ['park-bench', 'wood', 64, 50], ['park-bench', 'wood', 80, 50],
    // The plaza: fountain, benches around it, flowers and palms at the corners.
    ['fountain', 'stone', 44, 51], ['park-bench', 'wood', 40, 50], ['park-bench', 'wood', 49, 50], ['park-bench', 'wood', 40, 54], ['park-bench', 'wood', 49, 54],
    ['palm-tree-short', 'green', 39, 49], ['palm-tree-short', 'green', 52, 49], ['flower-bed', 'pink', 39, 55], ['flower-bed', 'pink', 51, 55],
    // The alley between the buildings: lamps, benches and a little greenery.
    ...every(21, 41, 6, (y) => [['street-lamp', 'black', 43, y], ['street-lamp', 'black', 47, y]]),
    ['park-bench', 'wood', 44, 30], ['flower-bed', 'pink', 41, 26], ['flower-bed', 'pink', 41, 34],
    // Northern walk: lamps between the ponds.
    ...every(30, 64, 8, (x) => [['street-lamp', 'black', x, 7]]),
    // Gardens south of the buildings.
    ['pine-tree-large', 'green', 2, 50], ['maple-tree', 'lightgreen', 8, 52], ['birch-tree', 'lightgreen', 30, 52], ['pine-tree-small', 'green', 35, 50],
    ['pine-tree-small', 'green', 56, 50], ['birch-tree', 'lightgreen', 62, 53], ['maple-tree', 'green', 76, 52], ['pine-tree-large', 'green', 88, 50],
    // The beach.
    ...every(1, 90, 6, (x) => (x >= 42 && x <= 48 ? [] : [['palm-tree', 'green', x, CAMPUS_SAND]])),
    ...sunSpot(6, CAMPUS_SAND + 3, 'red'), ...sunSpot(24, CAMPUS_SAND + 4, 'blue'), ...sunSpot(34, CAMPUS_SAND + 3, 'red'),
    ...sunSpot(54, CAMPUS_SAND + 3, 'blue'), ...sunSpot(64, CAMPUS_SAND + 4, 'red'), ...sunSpot(82, CAMPUS_SAND + 3, 'blue'),
    ['lifeguard-tower', 'white', 44, CAMPUS_SAND + 5], ['surfboard', 'white', 69, CAMPUS_SAND + 6], ['surfboard', 'white', 70, CAMPUS_SAND + 6], ['surfboard', 'white', 13, CAMPUS_SAND + 6],
    ['sandcastle', 'sand', 30, CAMPUS_SAND + 7], ['sandcastle', 'sand', 58, CAMPUS_SAND + 7], ['beach-ball', 'red', 50, CAMPUS_SAND + 7], ['beach-ball', 'red', 18, CAMPUS_SAND + 2],
    ['beach-rocks', 'grey', 2, CAMPUS_SAND + 7], ['beach-rocks', 'grey', 40, CAMPUS_SAND + 7], ['beach-rocks', 'grey', 89, CAMPUS_SAND + 7],
    ['rowboat', 'wood', 76, CAMPUS_SAND + 5], ['rowboat', 'wood', 20, CAMPUS_SAND + 5],
  ],
});

export const MAPS = { vivo: { ...vivo }, studio, campus };
export const MAP_IDS = Object.keys(MAPS);
