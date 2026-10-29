import * as vivo from './vivo.js';
import { composeMap } from './compose.js';

/** Office maps. Studio and Campus are built from Vivo's own rooms and furniture. */
const studio = composeMap(vivo, {
  cols: 33, rows: 34, spawn: { tx: 10, ty: 27 },
  stamps: [
    { rect: { x: 13, y: 20, w: 27, h: 23 }, dx: -10, dy: -12 }, // lobby, main hall with six desks, kitchen, lounge and the media room
    { rect: { x: 22, y: 11, w: 7, h: 7 }, dx: -10, dy: -11 }, // the koi pond in the garden
  ],
});
const campus = composeMap(vivo, {
  cols: 92, rows: 50, spawn: { tx: 20, ty: 39 },
  stamps: [
    { rect: { x: 0, y: 0, w: 46, h: 50 } }, // the whole office
    { rect: { x: 6, y: 0, w: 46, h: 50 }, dx: 40, suffix: '-b', label: '2' }, // and a second building beside it
  ],
});
export const MAPS = { vivo: { ...vivo }, studio, campus };
export const MAP_IDS = Object.keys(MAPS);
