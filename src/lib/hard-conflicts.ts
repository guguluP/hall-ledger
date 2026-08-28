import type { ParsedSlot, ParseResult } from "./timetable-parser";
import { isValidRoom, roomsEqual } from "./rooms";
import { padTime, rangesOverlap } from "./time";

/** Same room + overlapping time + two different sections → conflict */
export function detectHardConflicts(
  slots: ParsedSlot[],
): ParseResult["hardConflicts"] {
  const active = slots.filter((s) => isValidRoom(s.room));
  const conflicts: ParseResult["hardConflicts"] = [];
  const seen = new Set<string>();

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.section === b.section) continue;
      if (!roomsEqual(a.room, b.room)) continue;
      if (!rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

      const key = [a.room, a.dayOfWeek, a.section, b.section, padTime(a.startTime)]
        .map(String)
        .join("|");
      const key2 = [a.room, a.dayOfWeek, b.section, a.section, padTime(a.startTime)]
        .map(String)
        .join("|");
      if (seen.has(key) || seen.has(key2)) continue;
      seen.add(key);

      conflicts.push({
        type: "ROOM_OVERLAP",
        day: a.day,
        time: `${padTime(a.startTime)}–${padTime(a.endTime)}`,
        room: a.room || "",
        sections: [...new Set([a.section, b.section])],
        subjects: [`${a.section}: ${a.subject}`, `${b.section}: ${b.subject}`],
      });
    }
  }
  return conflicts;
}
