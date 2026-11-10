import type { OccupancySlot } from "@/lib/occupancy";
import { roomKey } from "@/lib/rooms";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function merge(items: { start: number; end: number }[]) {
  const sorted = items.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    if (!last || item.start > last.end) out.push({ ...item });
    else last.end = Math.max(last.end, item.end);
  }
  return out;
}

export type UsageRow = {
  name: string;
  building: string;
  floor: string;
  type: string;
  capacity: string;
  projector: string;
  smartBoard: string;
  ac: string;
  scheduledHours: number;
  availableHours: number;
  utilisation: number;
};

export function weeklyUsage(
  rooms: { name: string; building?: string | null; capacity?: number | null; isLab?: boolean; floor?: number | null; hasProjector?: boolean; hasSmartBoard?: boolean; hasAc?: boolean }[],
  slots: OccupancySlot[],
  dayStart: number,
  dayEnd: number,
  sundayOpen: boolean,
) {
  const openDays = sundayOpen ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  const span = Math.max(0, dayEnd - dayStart);
  const available = (span * openDays.length) / 60;
  const rows: UsageRow[] = rooms.map((room) => {
    let scheduled = 0;
    for (const day of openDays) {
      const intervals = slots
        .filter((slot) => Number(slot.dayOfWeek) === day && roomKey(slot.classroomName) === roomKey(room.name))
        .map((slot) => ({
          start: Math.max(dayStart, slot.startMin ?? 0),
          end: Math.min(dayEnd, slot.endMin ?? 0),
        }));
      scheduled += merge(intervals).reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0);
    }
    const hours = Math.round((scheduled / 60) * 10) / 10;
    const availableHours = Math.round(available * 10) / 10;
    return {
      name: room.name,
      building: room.building || "",
      floor: room.floor == null ? "" : String(room.floor),
      type: room.isLab ? "Lab" : "Classroom",
      capacity: room.capacity == null ? "" : String(room.capacity),
      projector: room.hasProjector ? "Yes" : "No",
      smartBoard: room.hasSmartBoard ? "Yes" : "No",
      ac: room.hasAc ? "Yes" : "No",
      scheduledHours: hours,
      availableHours,
      utilisation: availableHours > 0 ? Math.round((hours / availableHours) * 1000) / 10 : 0,
    };
  });
  const hours: number[] = [];
  for (let minute = dayStart; minute < dayEnd; minute += 60) hours.push(minute);
  const heatmap = openDays.map((day) => ({
    day,
    label: DAYS[day],
    cells: hours.map((minute) => ({
      minute,
      count: rooms.filter((room) => slots.some((slot) => (
        Number(slot.dayOfWeek) === day
        && roomKey(slot.classroomName) === roomKey(room.name)
        && (slot.startMin ?? 0) <= minute
        && minute < (slot.endMin ?? 0)
      ))).length,
    })),
  }));
  let peak = { day: "", minute: dayStart, count: 0 };
  for (const row of heatmap) {
    for (const cell of row.cells) {
      if (cell.count > peak.count) peak = { day: row.label, minute: cell.minute, count: cell.count };
    }
  }
  return { rows, heatmap, hours, peak };
}

function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function usageCsv(rows: UsageRow[]) {
  const header = ["Room", "Building", "Floor", "Type", "Capacity", "Projector", "Smart board", "AC", "Scheduled hours", "Available hours", "Utilisation %"];
  const lines = rows.map((row) => [
    row.name, row.building, row.floor, row.type, row.capacity, row.projector, row.smartBoard, row.ac, row.scheduledHours, row.availableHours, row.utilisation,
  ].map(cell).join(","));
  return [header.join(","), ...lines].join("\n");
}
