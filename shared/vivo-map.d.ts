export const TILE: 32;
export const WORLD: { readonly cols: number; readonly rows: number; readonly width: number; readonly height: number };
export type AreaType = 'Public' | 'Desk' | 'MeetingRoom' | 'Lobby' | 'Common' | 'Team';
export type Area = { id: string; name: string; type: AreaType; parent: string | null; x: number; y: number; w: number; h: number; depth: number; capacity: number | null; floor: string; floorColor: string; walls: string | null; doorways: { x: number; y: number; orientation: 'Horizontal' | 'Vertical' }[] };
export type MapObject = { id: string; parent: string | null; kind: string; family: string; color: string; facing: 'Up' | 'Down' | 'Left' | 'Right'; x: number; y: number; w: number; h: number; originX: number; originY: number; desk?: boolean; seat?: number[][]; blocks?: number[][]; wall?: boolean };
export const AREAS: Area[];
export const OBJECTS: MapObject[];
export const EXTRA_OBJECTS: MapObject[];
