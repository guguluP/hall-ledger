import type { HardConflict, SlotIn } from "@/lib/parse/timetable";
import { roomKey } from "@/lib/rooms";

export type RoomOption = { name: string; capacity: number | null; isLab: boolean };

export function suggestReplacements(
  conflicts: HardConflict[],
  rooms: RoomOption[],
  slots: SlotIn[],
  strengths: { section: string; students: number }[],
) {
  const bySection = new Map(strengths.map((row) => [row.section, row.students]));
  return conflicts.filter((conflict) => conflict.type === "ROOM_OVERLAP").slice(0, 20).map((conflict) => {
    const samples = slots.filter((slot) => conflict.sections.includes(slot.section) && roomKey(slot.room) === roomKey(conflict.room));
    const sample = samples[0];
    const need = Math.max(0, ...conflict.sections.map((section) => bySection.get(section) || 0));
    if (!sample) return { conflict, suggestions: [] as RoomOption[] };
    const busy = new Set(
      slots
        .filter((slot) => slot.dayOfWeek === sample.dayOfWeek && slot.startMin < sample.endMin && sample.startMin < slot.endMin)
        .map((slot) => roomKey(slot.room)),
    );
    const suggestions = rooms
      .filter((room) => !busy.has(roomKey(room.name)))
      .filter((room) => need <= 0 || (room.capacity != null && room.capacity >= need))
      .sort((a, b) => (a.capacity || 0) - (b.capacity || 0))
      .slice(0, 3);
    return { conflict, need, suggestions };
  });
}
