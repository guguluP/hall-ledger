import type { OccupancySlot } from "@/lib/occupancy";
import { roomKey } from "@/lib/rooms";
import { fromMinutes } from "@/lib/time";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type IstNow = { date: string; day: number; minutes: number };

export function istNow(date = new Date()): IstNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekday = pick("weekday").slice(0, 3);
  const day = Math.max(0, WEEK.indexOf(weekday));
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    day,
    minutes: Number(pick("hour")) * 60 + Number(pick("minute")),
  };
}

export function dayOfDate(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return utc.getUTCDay();
}

export type ClosureRow = { startDate: string; endDate: string; kind: string; label: string };

export function closureOn(closures: ClosureRow[], date: string): ClosureRow | null {
  return closures.find((row) => row.startDate <= date && date <= row.endDate) || null;
}

export type ChangeRow = {
  date: string;
  kind: string;
  section: string | null;
  subject: string | null;
  teacher: string | null;
  roomName: string | null;
  fromRoom: string | null;
  startMin: number;
  endMin: number;
  note: string | null;
};

export type BookingRow = { roomName: string; startMin: number; endMin: number; purpose: string };

function sameSlot(slot: OccupancySlot, change: ChangeRow, day: number) {
  if (Number(slot.dayOfWeek) !== day) return false;
  if ((slot.startMin ?? -1) !== change.startMin) return false;
  if (change.section && slot.sectionName !== change.section) return false;
  if (change.kind === "SWAP") {
    return !change.fromRoom || roomKey(slot.classroomName) === roomKey(change.fromRoom);
  }
  if (change.roomName && roomKey(slot.classroomName) !== roomKey(change.roomName)) return false;
  return true;
}

export function applyDatedChanges(
  slots: OccupancySlot[],
  day: number,
  changes: ChangeRow[],
  bookings: BookingRow[],
  options: { pauseWeekly?: boolean } = {},
): OccupancySlot[] {
  let next = options.pauseWeekly ? [] : slots.map((slot) => ({ ...slot }));
  for (const change of changes) {
    if (change.kind === "CANCEL") {
      next = next.filter((slot) => !sameSlot(slot, change, day));
    } else if (change.kind === "SWAP" && change.roomName) {
      next = next.map((slot) => (
        sameSlot(slot, change, day) ? { ...slot, classroomName: change.roomName || slot.classroomName } : slot
      ));
    } else if (change.kind === "EVENT" && change.roomName && change.endMin > change.startMin) {
      next.push({
        classroomName: change.roomName,
        sectionName: change.section,
        subjectName: change.subject || change.note || "Event",
        dayOfWeek: day,
        startTime: fromMinutes(change.startMin),
        endTime: fromMinutes(change.endMin),
        startMin: change.startMin,
        endMin: change.endMin,
      });
    }
  }
  for (const booking of bookings) {
    if (booking.endMin <= booking.startMin) continue;
    next.push({
      classroomName: booking.roomName,
      sectionName: null,
      subjectName: booking.purpose,
      dayOfWeek: day,
      startTime: fromMinutes(booking.startMin),
      endTime: fromMinutes(booking.endMin),
      startMin: booking.startMin,
      endMin: booking.endMin,
    });
  }
  return next;
}

export function campusNote(opts: {
  day: number;
  date: string | null;
  sundayOpen: boolean;
  closures: ClosureRow[];
}): { closed: boolean; exam: boolean; reason: string | null } {
  if (opts.date) {
    const closure = closureOn(opts.closures, opts.date);
    if (closure && closure.kind !== "EXAM") {
      return { closed: true, exam: false, reason: `${closure.label} — the campus is closed, so no room is free to use.` };
    }
    if (closure?.kind === "EXAM") {
      return { closed: false, exam: true, reason: `${closure.label} — weekly classes are paused. Only dated bookings and events count.` };
    }
  }
  if (opts.day === 0 && !opts.sundayOpen) {
    return { closed: true, exam: false, reason: "Sunday is a closed day, so no room is free to use." };
  }
  return { closed: false, exam: false, reason: null };
}
