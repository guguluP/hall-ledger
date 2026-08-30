import { buildingOf, isLabRoom, roomsEqual } from "./rooms";
import {
  coversStart,
  fromMinutes,
  labelTime,
  normalizeWindow,
  padTime,
  rangesOverlap,
  slotEndMinutes,
  slotMinutes,
  toMinutes,
} from "./time";

export type OccupancySlot = {
  classroomName: string;
  sectionName?: string | null;
  subjectName?: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

function sameDay(slotDay: number | string | null | undefined, day: number): boolean {
  if (slotDay == null || slotDay === "") return false;
  const n = Number(slotDay);
  return Number.isFinite(n) && n === Number(day);
}

export function slotInterval(slot: OccupancySlot): { start: number; end: number } | null {
  const start = slotMinutes(slot.startTime);
  if (start < 0) return null;
  const end = slotEndMinutes(slot.startTime, slot.endTime || "");
  if (end <= start) return null;
  return { start, end };
}

export function slotCovers(
  slot: OccupancySlot,
  room: string,
  day: number,
  start: string,
): boolean {
  if (!sameDay(slot.dayOfWeek, day)) return false;
  if (!roomsEqual(slot.classroomName, room)) return false;
  return coversStart(slot.startTime, slot.endTime || slot.startTime, start);
}

export function slotOverlapsWindow(
  slot: OccupancySlot,
  room: string | null,
  day: number,
  start: string,
  end: string,
): boolean {
  if (!sameDay(slot.dayOfWeek, day)) return false;
  if (room && !roomsEqual(slot.classroomName, room)) return false;
  if (!slot.classroomName) return false;
  const win = normalizeWindow(start, end);
  if (!win) return rangesOverlap(start, end, slot.startTime, slot.endTime || slot.startTime);
  const iv = slotInterval(slot);
  if (!iv) return false;
  return win.startMin < iv.end && iv.start < win.endMin;
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
    const iv = slotInterval(s);
    if (!iv) continue;
    min = Math.min(min, iv.start);
    max = Math.max(max, iv.end);
    starts.add(iv.start);
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
      const start = fromMinutes(m);
      return { start, label: labelTime(start) };
    });
}

function mergeIntervals(items: { start: number; end: number }[]): { start: number; end: number }[] {
  const xs = items
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const iv of xs) {
    const last = out[out.length - 1];
    if (!last || iv.start > last.end) out.push({ ...iv });
    else last.end = Math.max(last.end, iv.end);
  }
  return out;
}

function freeGaps(
  occupied: { start: number; end: number }[],
  from: number,
  to: number,
): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];
  let cursor = from;
  for (const iv of occupied) {
    if (iv.end <= from) continue;
    if (iv.start >= to) break;
    const occStart = Math.max(iv.start, from);
    if (occStart > cursor) gaps.push({ start: cursor, end: occStart });
    cursor = Math.max(cursor, iv.end);
  }
  if (cursor < to) gaps.push({ start: cursor, end: to });
  return gaps;
}

export type FreeGap = { from: string; until: string };

export type FreeRoom = {
  id: string;
  name: string;
  building: string;
  capacity: number;
  isLab: boolean;
  freeFrom: string;
  freeUntil: string;
  nextBooking: string | null;
  fullyFree?: boolean;
  gaps?: FreeGap[];
};

function occupiedForRoom(
  slots: OccupancySlot[],
  room: string,
  day: number,
): { start: number; end: number; slot: OccupancySlot }[] {
  const items: { start: number; end: number; slot: OccupancySlot }[] = [];
  for (const s of slots) {
    if (!sameDay(s.dayOfWeek, day)) continue;
    if (!s.classroomName || !roomsEqual(s.classroomName, room)) continue;
    const iv = slotInterval(s);
    if (!iv) continue;
    items.push({ ...iv, slot: s });
  }
  items.sort((a, b) => a.start - b.start);
  return items;
}

function nextBookingLabel(
  occupied: { start: number; end: number; slot: OccupancySlot }[],
  after: number,
): string | null {
  const next = occupied.find((x) => x.start >= after);
  if (!next) return null;
  const who = next.slot.sectionName || next.slot.subjectName || "Booked";
  return `${labelTime(next.start)} – ${who}`;
}

export function findAvailability(
  rooms: { name: string; building?: string | null; capacity?: number }[],
  slots: OccupancySlot[],
  day: number,
  start: string,
  end: string,
  labsOnly = false,
): { free: FreeRoom[]; partial: FreeRoom[] } {
  const free: FreeRoom[] = [];
  const partial: FreeRoom[] = [];

  // No timetable → no occupancy knowledge. Never pretend every hall is free.
  if (!slots.length) return { free, partial };

  const win = normalizeWindow(start, end);
  if (!win) return { free, partial };

  for (const room of rooms) {
    if (labsOnly && !isLabRoom(room.name)) continue;
    const occ = occupiedForRoom(slots, room.name, day);
    const merged = mergeIntervals(occ);
    const overlaps = merged.some((iv) => win.startMin < iv.end && iv.start < win.endMin);
    const gaps = freeGaps(merged, win.startMin, win.endMin);
    const covering = freeGaps(merged, Math.min(win.startMin, 9 * 60 + 30), Math.max(win.endMin, 17 * 60 + 30))
      .find((g) => g.start <= win.startMin && g.end >= win.endMin);

    const gapLabels: FreeGap[] = gaps
      .filter((g) => g.end - g.start >= 20)
      .map((g) => ({ from: labelTime(g.start), until: labelTime(g.end) }));

    const base = {
      id: room.name,
      name: room.name,
      building: room.building || buildingOf(room.name),
      capacity: room.capacity || 60,
      isLab: isLabRoom(room.name),
      gaps: gapLabels,
    };

    if (!overlaps && covering) {
      free.push({
        ...base,
        fullyFree: true,
        freeFrom: labelTime(Math.max(covering.start, win.startMin)),
        freeUntil: labelTime(covering.end),
        nextBooking: nextBookingLabel(occ, win.endMin),
      });
    } else if (gapLabels.length) {
      const first = gaps[0];
      partial.push({
        ...base,
        fullyFree: false,
        freeFrom: first ? labelTime(first.start) : labelTime(win.startMin),
        freeUntil: first ? labelTime(first.end) : labelTime(win.endMin),
        nextBooking: nextBookingLabel(occ, win.startMin),
      });
    }
  }

  return { free, partial };
}

export function findFreeRooms(
  rooms: { name: string; building?: string | null; capacity?: number }[],
  slots: OccupancySlot[],
  day: number,
  start: string,
  end: string,
  labsOnly = false,
): FreeRoom[] {
  return findAvailability(rooms, slots, day, start, end, labsOnly).free;
}

export { toMinutes, padTime, normalizeWindow };
