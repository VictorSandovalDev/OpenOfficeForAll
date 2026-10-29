import type { ReactNode } from 'react';
import { PixelPlant, PixelTree } from '../PixelPlants';
import { PixelPond } from '../PixelPond';
import { shade } from './pixel';
import { Pixel } from './PixelSprite';
import { furnitureSprite } from './furniture';
import { objectAssetUrl } from './assets';
import { asMapObject } from '../../shared/office-objects.js';
import { REFERENCE_OBJECTS } from './referenceObjects';
import { REFERENCE_FOREGROUNDS } from './referenceForegrounds';

export type MapObjectData = { id: string; parent?: string | null; kind: string; family: string; color: string; facing: 'Up' | 'Down' | 'Left' | 'Right'; x: number; y: number; w: number; h: number; originX: number; originY: number; desk?: boolean; seat?: number[][]; blocks?: number[][]; wall?: boolean };

const COLOR: Record<string, string> = {
  white: '#e6e8f2', black: '#3a4150', grey: '#9aa3ad', blue: '#3f7fd8', lightblue: '#8fd0ea', teal: '#3aa6b5', lightteal: '#8ed6dc',
  green: '#5fb85b', lightgreen: '#86d26a', red: '#e4484f', orange: '#e4883b', yellow: '#f2c94c', purple: '#9b5cd6', pink: '#ee6fa6',
  brown: '#a9714b', coffee: '#c99a6a', lightcoffee: '#e2b98b',
};
const FAMILY_FALLBACK: Record<string, string> = { Tree: '#5faa5e', 'Room Plant': '#5fb85b', 'Desk Plant': '#6cc26a', 'Ground Plant': '#58b357', Desk: '#e6e8f2', Chair: '#3a4150' };

/** Objects that reuse existing original artwork until their dedicated sprite exists. */
function legacy(object: MapObjectData): ReactNode | null {
  const foot = { x: object.originX, y: object.originY };
  switch (object.kind) {
    case 'pine-tree-large': return <g transform={`translate(${foot.x} ${object.h - 8}) scale(${object.h / 118})`}><PixelTree variant="pine" /></g>;
    case 'pine-tree-small': return <g transform={`translate(${foot.x} ${object.h - 6}) scale(${object.h / 118})`}><PixelTree variant="pine" /></g>;
    case 'birch-tree': return <g transform={`translate(${foot.x} ${object.h - 10}) scale(${object.h / 118})`}><PixelTree variant="birch" /></g>;
    case 'maple-tree': return <g transform={`translate(${foot.x} ${object.h - 10}) scale(${object.h / 118})`}><PixelTree variant="round" /></g>;
    case 'ficus': case 'fiddle-leaf-fig': case 'bird-of-paradise-green': case 'bamboo-planter': case 'philodendron': case 'ceramic-planter':
      return <g transform={`translate(${foot.x} ${object.h - 2}) scale(${Math.min(1, object.h / 60)})`}><PixelPlant large={object.h > 40} /></g>;
    case 'koi-pond': return <g transform={`translate(${-734 + 2} ${-162 + 2}) scale(${object.w / 132})`}><PixelPond /></g>;
    default: return null;
  }
}

/** Generic silhouette for objects without dedicated artwork: keeps the reference footprint and palette. */
function Placeholder({ object }: { object: MapObjectData }) {
  const base = COLOR[object.color] ?? FAMILY_FALLBACK[object.family] ?? '#8a93a8';
  const top = Math.max(2, Math.round(object.h * 0.3));
  return <g>
    <rect x="0" y="0" width={object.w} height={object.h} fill={shade(base, 0.55)} />
    <rect x="1" y="1" width={object.w - 2} height={object.h - 2} fill={base} />
    <rect x="1" y="1" width={object.w - 2} height={top} fill={shade(base, 1.18)} />
    <rect x="1" y={object.h - 3} width={object.w - 2} height="2" fill={shade(base, 0.7)} />
  </g>;
}

/** Draws an object with its sprite origin at (0, 0): the image's top-left is at (-originX, -originY). */
export function ObjectArt({ object }: { object: MapObjectData }) {
  const reference = REFERENCE_OBJECTS[`${object.kind}/${object.color}/${object.facing}`];
  const asset = reference ? null : objectAssetUrl(object.kind, object.color, object.facing);
  const sprite = reference ?? (asset ? null : furnitureSprite(object.kind, object.color, object.facing));
  const art = sprite ? <Pixel sprite={sprite} x={Math.round((object.w - sprite.w) / 2)} y={object.h - sprite.h} />
    : asset ? <image className="pixel-resource" href={asset} x={0} y={0} width={object.w} height={object.h} preserveAspectRatio="xMidYMax meet" transform={object.facing === 'Left' && object.kind === 'maple-tree' ? `translate(${object.w} 0) scale(-1 1)` : undefined} />
    : legacy(object);
  return <g transform={`translate(${-object.originX} ${-object.originY})`}>{art ?? <Placeholder object={object} />}</g>;
}

/** Catalogue thumbnail: the object drawn to fit a square box. */
export function ObjectThumb({ item, size = 48 }: { item: { kind: string; color: string; facing: string }; size?: number }) {
  const data = asMapObjectForThumb(item);
  const scale = Math.min(1.6, (size - 6) / Math.max(data.w, data.h));
  return <svg className="object-thumb" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" shapeRendering="crispEdges">
    <g transform={`translate(${(size - data.w * scale) / 2} ${(size - data.h * scale) / 2}) scale(${scale}) translate(${data.originX} ${data.originY})`}><ObjectArt object={data} /></g>
  </svg>;
}
function asMapObjectForThumb(item: { kind: string; color: string; facing: string }): MapObjectData {
  return asMapObject({ id: 'thumb', kind: item.kind, color: item.color, facing: item.facing, x: 16, y: 16 }) as MapObjectData;
}

/** Part of a seat drawn above its occupant, or null when the object has none. */
export function ObjectForeground({ object }: { object: MapObjectData }) {
  const sprite = REFERENCE_FOREGROUNDS[`${object.kind}/${object.color}/${object.facing}`];
  if (!sprite) return null;
  return <g transform={`translate(${-object.originX} ${-object.originY})`}><Pixel sprite={sprite} x={Math.round((object.w - sprite.w) / 2)} y={object.h - sprite.h} /></g>;
}
export const hasForeground = (object: { kind: string; color: string; facing: string }) => `${object.kind}/${object.color}/${object.facing}` in REFERENCE_FOREGROUNDS;
