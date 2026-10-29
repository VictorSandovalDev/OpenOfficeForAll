import { px, type PixelSprite } from './pixel';
import { spritePaths } from './pixel';
import { REFERENCE_FLOORS } from './referenceFloors';
import { artPack } from './artPack';

/** Floor textures of the reference office, 32 × 32 tiles. Keys follow the area data (`floor` + `floorColor`). */
/** Lawn with texture: a mid green base, darker tufts and light blade tips, tileable at 32 px. */
function lawn(): PixelSprite {
  const rows: string[] = [];
  const tufts = [[3, 2], [14, 5], [25, 3], [8, 11], [20, 13], [29, 10], [2, 19], [12, 22], [23, 20], [6, 28], [17, 29], [28, 26]];
  const blades = [[9, 1], [19, 3], [30, 7], [1, 8], [16, 9], [27, 16], [5, 15], [11, 18], [22, 24], [0, 25], [14, 26], [31, 29], [8, 31], [24, 31]];
  for (let y = 0; y < 32; y++) {
    let row = '';
    for (let x = 0; x < 32; x++) {
      let ch = (x * 7 + y * 13) % 11 === 0 ? 'm' : 'b';
      for (const [tx, ty] of tufts) {
        const dx = x - tx, dy = y - ty;
        if ((dx === 0 && dy >= -1 && dy <= 1) || (dy === 1 && Math.abs(dx) === 1) || (dy === 0 && Math.abs(dx) === 1)) ch = 'd';
        if (dx === 0 && dy === -2) ch = 'l';
      }
      for (const [bx, by] of blades) if (x === bx && y === by) ch = 'l';
      row += ch;
    }
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: '#4e8a48', m: '#478040', d: '#3d7239', l: '#69a65c' }, rows };
}
const grass = lawn();

function slats(base: string, seam: string): PixelSprite {
  // Horizontal planks, 8 px tall, with staggered vertical joints.
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    const plank = Math.floor(y / 8);
    const joint = [6, 22, 14, 30][plank];
    let row = '';
    for (let x = 0; x < 32; x++) row += y % 8 === 7 ? 's' : x === joint ? 's' : 'b';
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: base, s: seam }, rows };
}
const woodLight = slats('#a27f6b', '#98735f');
const wood = slats('#98735f', '#8f6b59');

/** Offset blocks: 16 × 8 bricks that step half a block left and right row by row, with a 1 px saw edge. */
function steps(base: string, block: string): PixelSprite {
  const rows: string[] = [];
  const shift = [0, 8, 0, 24];
  for (let y = 0; y < 32; y++) {
    const start = shift[Math.floor(y / 8)] + (y % 2);
    let row = '';
    for (let x = 0; x < 32; x++) row += ((x - start + 32) % 32) < 16 ? 'w' : 'b';
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: base, w: block }, rows };
}
const carpetWavyBlue = steps('#465368', '#536176');
const carpetWavyGray = steps('#616670', '#6a6d77');

/** Wide vertical bands, 16 px each, with a 1 px saw edge. */
function stripe(base: string, line: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) { let row = ''; for (let x = 0; x < 32; x++) row += ((x - 8 + (y % 2 ? 1 : 0) + 32) % 32) < 17 ? 'l' : 'b'; rows.push(row); }
  return { w: 32, h: 32, palette: { b: base, l: line }, rows };
}
const carpetStripeGray = stripe('#616670', '#6a6d77');

/** A medallion carpet: a ring with a cross and a centre stone in every tile, quarter flowers at the corners. */
function couture(base: string, motif: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = '';
    for (let x = 0; x < 32; x++) {
      const dx = x - 15.5, dy = y - 15.5, r = Math.hypot(dx, dy);
      const cx = Math.min(x, 31 - x), cy = Math.min(y, 31 - y), corner = Math.hypot(cx, cy);
      const ring = r > 8.5 && r < 11.5;
      const cross = (Math.abs(dx) < 1.5 && r < 8) || (Math.abs(dy) < 1.5 && r < 8);
      const stone = r < 3;
      const petals = corner < 6.5 && !(corner < 3.5 && corner > 2);
      const dots = (Math.abs(Math.abs(dx) - Math.abs(dy)) < 1 && r > 12.5 && r < 14.5);
      row += ring || cross || stone || petals || dots ? 'm' : 'b';
    }
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: base, m: motif }, rows };
}
const carpetCoutureWhite = couture('#8e8d9b', '#8b8596');

/** A diamond lattice drawn with double lines along both diagonals. */
function diamond(base: string, line: string): PixelSprite {
  const rows: string[] = [];
  const band = (v: number) => [1, 2, 3, 6, 7, 8].includes(v);
  for (let y = 0; y < 32; y++) { let row = ''; for (let x = 0; x < 32; x++) row += band((x + y + 4) % 32) || band((x - y + 36) % 32) ? 'l' : 'b'; rows.push(row); }
  return { w: 32, h: 32, palette: { b: base, l: line }, rows };
}
const carpetDiamondWhite = diamond('#9c949f', '#8e8d9b');

/** The project's own floor drawings, used by the original art pack. */
export const ORIGINAL_FLOOR_TILES: Record<string, PixelSprite> = {
  'NewStyleGrass/Green': grass,
  'WoodSlatsLt/LightWood': woodLight,
  'WoodSlats/Wood': wood,
  'CarpetWave/Blue': carpetWavyBlue,
  'CarpetWaveGray/LightGray': carpetWavyGray,
  'CarpetStripeGray/LightGray': carpetStripeGray,
  'CarpetCouture/White': carpetCoutureWhite,
  'CarpetDiamond/LightWhite': carpetDiamondWhite,
};
export const FLOOR_TILES: Record<string, PixelSprite> = { ...ORIGINAL_FLOOR_TILES, ...REFERENCE_FLOORS };
export const floorKey = (texture: string, color: string) => `${texture}/${color}`;
export const floorPatternId = (key: string) => `floor-${key.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

/** SVG pattern definitions for every floor tile. */
export function FloorPatterns() {
  return <defs>
    {Object.entries(artPack() === 'reference' ? FLOOR_TILES : ORIGINAL_FLOOR_TILES).map(([key, sprite]) => <pattern key={key} id={floorPatternId(key)} width="32" height="32" patternUnits="userSpaceOnUse">
      {spritePaths(sprite).map(path => <path key={path.color} d={path.d} fill={path.color} />)}
    </pattern>)}
  </defs>;
}
