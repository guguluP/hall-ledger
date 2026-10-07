import { describe, expect, it } from "vitest";
import { detectHardConflicts } from "@/lib/hard-conflicts";
import type { ParsedSlot } from "@/lib/timetable-parser";

function slot(over: Partial<ParsedSlot>): ParsedSlot {
  return {
    section: "SECTION-A",
    room: "316",
    day: "Monday",
    dayOfWeek: 1,
    startTime: "09:30",
    endTime: "10:30",
    subjectRaw: "Maths",
    subject: "Maths",
    type: "THEORY",
    roomOverride: null,
    isCombined: false,
    ...over,
  } as ParsedSlot;
}

describe("detectHardConflicts", () => {
  it("flags two sections in the same room at overlapping times", () => {
    const out = detectHardConflicts([
      slot({ section: "SECTION-A", subject: "Maths" }),
      slot({ section: "SECTION-B", subject: "Physics", startTime: "10:00", endTime: "11:00" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "ROOM_OVERLAP", room: "316", day: "Monday" });
    expect(out[0].sections.sort()).toEqual(["SECTION-A", "SECTION-B"]);
  });

  it("does not flag back-to-back classes", () => {
    const out = detectHardConflicts([
      slot({ section: "SECTION-A" }),
      slot({ section: "SECTION-B", startTime: "10:30", endTime: "11:30" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("ignores the same section, different days and different rooms", () => {
    expect(
      detectHardConflicts([slot({ section: "SECTION-A" }), slot({ section: "SECTION-A" })]),
    ).toHaveLength(0);
    expect(
      detectHardConflicts([
        slot({ section: "SECTION-A" }),
        slot({ section: "SECTION-B", dayOfWeek: 2, day: "Tuesday" }),
      ]),
    ).toHaveLength(0);
    expect(
      detectHardConflicts([slot({ section: "SECTION-A" }), slot({ section: "SECTION-B", room: "317" })]),
    ).toHaveLength(0);
  });

  it("ignores slots without a usable room", () => {
    const out = detectHardConflicts([
      slot({ section: "SECTION-A", room: null }),
      slot({ section: "SECTION-B", room: null }),
      slot({ section: "SECTION-C", room: "TBD" }),
      slot({ section: "SECTION-D", room: "TBD" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("treats spelling variants of one room as the same room", () => {
    const out = detectHardConflicts([
      slot({ section: "SECTION-A", room: "ME-01" }),
      slot({ section: "SECTION-B", room: "ME1" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("reports each clashing pair once", () => {
    const out = detectHardConflicts([
      slot({ section: "SECTION-A" }),
      slot({ section: "SECTION-B" }),
      slot({ section: "SECTION-B" }),
    ]);
    // A/B is reported once even though B appears twice at the same time
    expect(out).toHaveLength(1);
  });
});
