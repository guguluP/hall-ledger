import { detectHardConflicts, labelMinutes, type SlotIn } from "@/lib/parse/timetable";

export function minuteRangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export function conflictsFor(slots: SlotIn[]) {
  return detectHardConflicts(slots).map((conflict) => ({
    ...conflict,
    message: `${conflict.room} is double-booked ${conflict.day} ${conflict.time} (${conflict.sections.join(", ")})`,
  }));
}

export { labelMinutes };
