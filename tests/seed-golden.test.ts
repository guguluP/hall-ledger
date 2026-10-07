import { describe, expect, it } from "vitest";
import seed from "@/data/default-timetable.json";
import { FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { padTime } from "@/lib/time";
import { detectHardConflicts } from "@/lib/hard-conflicts";
import type { ParsedSlot } from "@/lib/timetable-parser";

/**
 * Golden numbers for the bundled 2025–26 seed. If you regenerate the seed on
 * purpose, update these in the same commit so the change is visible in review.
 */
const GOLDEN = {
  slots: 340,
  sections: 16,
  rooms: 27,
  roomsInUse: 20,
  conflicts: 35,
  // Known data-quality gap: slots whose room could not be read from the workbook.
  slotsWithoutRoom: 14,
};

const slots = seed.slots as {
  classroomName: string;
  sectionName: string | null;
  subjectName: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
}[];

describe("bundled 2025–26 seed", () => {
  it("matches the published stats block", () => {
    expect(seed.stats).toEqual({
      sections: GOLDEN.sections,
      slots: GOLDEN.slots,
      rooms: GOLDEN.rooms,
      roomsInUse: GOLDEN.roomsInUse,
      conflicts: GOLDEN.conflicts,
    });
  });

  it("really contains the slots, sections and rooms it claims", () => {
    expect(slots).toHaveLength(GOLDEN.slots);
    expect(new Set(slots.map((s) => s.sectionName)).size).toBe(GOLDEN.sections);
    expect(new Set(slots.map((s) => s.classroomName).filter(Boolean)).size).toBe(GOLDEN.roomsInUse);
    expect(seed.rooms).toHaveLength(GOLDEN.rooms);
  });

  it("tracks the slots that still have no room", () => {
    expect(slots.filter((s) => !s.classroomName)).toHaveLength(GOLDEN.slotsWithoutRoom);
  });

  it("only uses known halls", () => {
    const known = new Set<string>(FULL_TIMETABLE_ROOMS);
    const unknown = [...new Set(slots.map((s) => s.classroomName).filter(Boolean))].filter((r) => !known.has(r));
    expect(unknown).toEqual([]);
  });

  it("has valid days and zero-padded times on every slot", () => {
    for (const s of slots) {
      expect(s.dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(s.dayOfWeek).toBeLessThanOrEqual(6);
      expect(s.startTime).toBe(padTime(s.startTime));
      expect(s.endTime).toBe(padTime(s.endTime));
      expect(s.startTime < s.endTime).toBe(true);
    }
  });

  it("agrees with the conflict detector about how many clashes it has", () => {
    const asParsed = slots.map(
      (s) =>
        ({
          section: s.sectionName ?? "",
          room: s.classroomName || null,
          day: String(s.dayOfWeek),
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subjectName ?? "",
          subjectRaw: s.subjectName ?? "",
        }) as ParsedSlot,
    );
    expect(detectHardConflicts(asParsed)).toHaveLength(GOLDEN.conflicts);
  });
});
