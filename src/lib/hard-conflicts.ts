import type { ParsedSlot, ParseResult } from "./timetable-parser";
import { isValidRoom } from "./timetable-parser";

function normalizeRoom(room: string | null | undefined): string {
  if (!room) return "";
  return room.trim().toUpperCase().replace(/\s+/g, "");
}

/** Same room + day + start time, two different sections -> conflict */
export function detectHardConflicts(
  slots: ParsedSlot[],
): ParseResult["hardConflicts"] {
  const byKey = new Map<string, ParsedSlot[]>();

  for (const s of slots) {
    if (!isValidRoom(s.room)) continue;
    const key = `${normalizeRoom(s.room)}|${s.dayOfWeek}|${s.startTime}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(s);
  }

  const conflicts: ParseResult["hardConflicts"] = [];
  for (const [, group] of byKey) {
    const uniqueSections = [...new Set(group.map((s) => s.section))];
    if (uniqueSections.length < 2) continue;
    conflicts.push({
      type: "ROOM_OVERLAP",
      day: group[0].day,
      time: `${group[0].startTime}-${group[0].endTime}`,
      room: group[0].room || "",
      sections: uniqueSections,
      subjects: group.map((s) => `${s.section}: ${s.subject}`),
    });
  }
  return conflicts;
}
