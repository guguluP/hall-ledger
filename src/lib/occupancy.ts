import { buildingOf, isLabRoom, roomsEqual } from "./rooms";
import { coversStart, labelTime, padTime, rangesOverlap, toMinutes } from "./time";

export type OccupancySlot = {
  classroomName: string;
  sectionName?: string | null;
  subjectName?: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

export function slotCovers(
  slot: OccupancySlot,
  room: string,
  day: number,
  start: string,
): boolean {
  if (slot.dayOfWeek !== day) return false;
  if (!roomsEqual(slot.classroomName, room)) return false;
  return coversStart(padTime(slot.startTime), padTime(slot.endTime || slot.startTime), padTime(start));
}

export function slotOverlapsWindow(
  slot: OccupancySlot,
  room: string | null,
  day: number,
  start: string,
  end: string,
): boolean {
  if (slot.dayOfWeek !== day) return false;
  if (room && !roomsEqual(slot.classroomName, room)) return false;
  if (!slot.classroomName) return false;
  return rangesOverlap(start, end, padTime(slot.startTime), padTime(slot.endTime || slot.startTime));
}

export function findSlot(
  slots: OccupancySlot[],
  room: string,
  day: number,
  start: string,
): OccupancySlot | undefined {
  return slots.find((s) => slotCovers(s, room, day, start));
}

export function buildTimeRows(slots: OccupancySlot[]): { start: string; label: string }[] {
  const fallback = [
    "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30",
  ];
  if (!slots.length) {
    return fallback.map((start) => ({ start, label: labelTime(start) }));
  }

  let min = Infinity;
  let max = -Infinity;
  const starts = new Set<number>();
  for (const s of slots) {
    const a = toMinutes(padTime(s.startTime));
    const b = toMinutes(padTime(s.endTime || s.startTime));
    if (a >= 0) {
      min = Math.min(min, a);
      starts.add(a);
    }
    if (b >= 0) max = Math.max(max, b);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return fallback.map((start) => ({ start, label: labelTime(start) }));
  }

  const step = 60;
  const aligned = min % 30 === 0 ? min : Math.floor(min / 30) * 30;
  const rows = new Set<number>();
  for (let t = aligned; t < max; t += step) rows.add(t);
  for (const s of starts) rows.add(s);
  return [...rows]
    .sort((a, b) => a - b)
    .map((m) => {
      const start = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return { start, label: labelTime(start) };
    });
}

export type FreeRoom = {
  id: string;
  name: string;
  building: string;
  capacity: number;
  isLab: boolean;
  freeFrom: string;
  freeUntil: string;
  nextBooking: string | null;
};

export function findFreeRooms(
  rooms: { name: string; building?: string | null; capacity?: number }[],
  slots: OccupancySlot[],
  day: number,
  start: string,
  end: string,
  labsOnly = false,
): FreeRoom[] {
  const out: FreeRoom[] = [];
  for (const room of rooms) {
    if (labsOnly && !isLabRoom(room.name)) continue;
    const hits = slots
      .filter((s) => slotOverlapsWindow(s, room.name, day, start, end))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    if (hits.length) continue;

    const later = slots
      .filter(
        (s) =>
          s.dayOfWeek === day &&
          roomsEqual(s.classroomName, room.name) &&
          toMinutes(s.startTime) >= toMinutes(end),
      )
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];

    out.push({
      id: room.name,
      name: room.name,
      building: room.building || buildingOf(room.name),
      capacity: room.capacity || 60,
      isLab: isLabRoom(room.name),
      freeFrom: labelTime(start),
      freeUntil: later ? labelTime(later.startTime) : labelTime(end),
      nextBooking: later
        ? `${labelTime(later.startTime)} – ${later.sectionName || later.subjectName || "Booked"}`
        : null,
    });
  }
  return out;
}
