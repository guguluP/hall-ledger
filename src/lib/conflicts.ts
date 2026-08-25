import { timeToMinutes, rangesOverlap } from "./utils";

export type SlotLike = {
  id: string;
  classroomId: string;
  teacherId?: string | null;
  dayOfWeek?: number | null;
  specificDate?: Date | null;
  startTime: string;
  endTime: string;
  status: string;
};

export type HardConflict = {
  type: "ROOM_OVERLAP" | "TEACHER_OVERLAP";
  slotAId: string;
  slotBId: string;
  message: string;
};

export function detectHardConflicts(slots: SlotLike[]): HardConflict[] {
  const active = slots.filter((s) => s.status !== "CANCELLED");
  const conflicts: HardConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      const sameDay =
        (a.dayOfWeek != null && a.dayOfWeek === b.dayOfWeek) ||
        (a.specificDate &&
          b.specificDate &&
          a.specificDate.toDateString() === b.specificDate.toDateString());

      if (!sameDay) continue;

      if (!rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

      if (a.classroomId === b.classroomId) {
        conflicts.push({
          type: "ROOM_OVERLAP",
          slotAId: a.id,
          slotBId: b.id,
          message: `Room conflict: two slots overlap in the same classroom (${a.startTime}-${a.endTime} vs ${b.startTime}-${b.endTime})`,
        });
      }

      if (a.teacherId && b.teacherId && a.teacherId === b.teacherId) {
        conflicts.push({
          type: "TEACHER_OVERLAP",
          slotAId: a.id,
          slotBId: b.id,
          message: `Teacher conflict: same teacher double-booked (${a.startTime}-${a.endTime} vs ${b.startTime}-${b.endTime})`,
        });
      }
    }
  }

  return conflicts;
}

export function isClassroomFree(
  classroomId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  existingSlots: SlotLike[],
  blocks: { classroomId: string; startAt: Date; endAt: Date }[] = []
): { free: boolean; reason?: string } {
  const relevant = existingSlots.filter(
    (s) =>
      s.classroomId === classroomId &&
      s.status !== "CANCELLED" &&
      s.dayOfWeek === dayOfWeek
  );

  for (const slot of relevant) {
    if (rangesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
      return {
        free: false,
        reason: `Overlaps with existing slot ${slot.startTime}-${slot.endTime}`,
      };
    }
  }

  return { free: true };
}
