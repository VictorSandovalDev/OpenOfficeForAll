import { px, type PixelSprite } from './pixel';
import { spritePaths } from './pixel';
import { REFERENCE_FLOORS } from './referenceFloors';

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

function wavy(base: string, wave: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = '';
    for (let x = 0; x < 32; x++) {
      const phase = (x + Math.floor(y / 4) * 4) % 16;
      row += phase < 8 && (y % 8) < 4 ? 'w' : 'b';
    }
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: base, w: wave }, rows };
}
const carpetWavyBlue = wavy('#465368', '#536176');
const carpetWavyGray = wavy('#616670', '#6a6d77');

function stripe(base: string, line: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) { let row = ''; for (let x = 0; x < 32; x++) row += (x % 4) < 2 ? 'l' : 'b'; rows.push(row); }
  return { w: 32, h: 32, palette: { b: base, l: line }, rows };
}
const carpetStripeGray = stripe('#616670', '#6a6d77');

function couture(base: string, motif: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = '';
    for (let x = 0; x < 32; x++) {
      const cx = Math.abs((x % 16) - 8), cy = Math.abs((y % 16) - 8);
      row += (cx + cy === 6 || (cx <= 1 && cy <= 1) || (cx === 0 && cy === 4) || (cy === 0 && cx === 4)) ? 'm' : 'b';
    }
    rows.push(row);
  }
  return { w: 32, h: 32, palette: { b: base, m: motif }, rows };
}
const carpetCoutureWhite = couture('#8b8596', '#8e8d9b');

function diamond(base: string, line: string): PixelSprite {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) { let row = ''; for (let x = 0; x < 32; x++) row += ((x + y) % 16 === 0 || (x - y + 32) % 16 === 0) ? 'l' : 'b'; rows.push(row); }
  return { w: 32, h: 32, palette: { b: base, l: line }, rows };
}
const carpetDiamondWhite = diamond('#9c949f', '#8e8d9b');

export const FLOOR_TILES: Record<string, PixelSprite> = {
  'NewStyleGrass/Green': grass,
  // Fallbacks drawn in code, overridden below by the patterns measured from the reference.
  'WoodSlatsLt/LightWood': woodLight,
  'WoodSlats/Wood': wood,
  'CarpetWave/Blue': carpetWavyBlue,
  'CarpetWaveGray/LightGray': carpetWavyGray,
  'CarpetStripeGray/LightGray': carpetStripeGray,
  'CarpetCouture/White': carpetCoutureWhite,
  'CarpetDiamond/LightWhite': carpetDiamondWhite,
  ...REFERENCE_FLOORS,
};
export const floorKey = (texture: string, color: string) => `${texture}/${color}`;
export const floorPatternId = (key: string) => `floor-${key.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

/** SVG pattern definitions for every floor tile. */
export function FloorPatterns() {
  return <defs>
    {Object.entries(FLOOR_TILES).map(([key, sprite]) => <pattern key={key} id={floorPatternId(key)} width="32" height="32" patternUnits="userSpaceOnUse">
      {spritePaths(sprite).map(path => <path key={path.color} d={path.d} fill={path.color} />)}
    </pattern>)}
  </defs>;
}
