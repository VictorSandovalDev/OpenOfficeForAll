import { AREAS, TILE } from './vivo-map.js';
import { areaAt, privateRoomOf } from './vivo-geometry.js';

/** Meeting rooms of the office (the reference's MeetingRoom areas: the large room and the huddles). */
export const MEETING_ROOMS = AREAS.filter((area) => area.type === 'MeetingRoom');
export const meetingRoom = (areaId) => MEETING_ROOMS.find((area) => area.id === areaId) ?? null;
/** The meeting room a point is in, if any. */
export const meetingRoomOf = (point) => privateRoomOf(point);
export const meetingRoomAt = (tx, ty) => { const area = areaAt(tx, ty); return area && area.type === 'MeetingRoom' ? area : null; };
export const inMeetingRoom = (point, area) => meetingRoomOf(point)?.id === area.id;
/** Seats inside a room, nearest to the room's centre first (the reference sits you at the table). */
export function roomSeats(area, seats) {
  const cx = (area.x + area.w / 2) * TILE, cy = (area.y + area.h / 2) * TILE;
  return seats.filter((seat) => meetingRoomAt(seat.tx, seat.ty)?.id === area.id).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
}
export const DEFAULT_MEETING = { locked: false };
