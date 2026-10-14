import { describe, expect, it } from "vitest";
import { normalizeWindow, parseTimeToMinutes } from "@/lib/time";
import { findAvailability } from "@/lib/occupancy";
import { minuteRangesOverlap } from "@/lib/conflicts";
import { VacancyQuery } from "@/lib/schemas";

describe("time and vacancy", () => {
  it("rejects equal times, 24:00, and invalid input", () => {
    expect(parseTimeToMinutes("24:00")).toBe(-1);
    expect(parseTimeToMinutes("nope")).toBe(-1);
    expect(normalizeWindow("18:00", "18:00")).toBeNull();
    expect(VacancyQuery.safeParse({ day: 1, start: "10:00", end: "10:00" }).success).toBe(false);
    expect(VacancyQuery.safeParse({ day: 1, start: "24:00", end: "25:00" }).success).toBe(false);
    expect(VacancyQuery.safeParse({ day: 9, start: "10:00", end: "11:00" }).success).toBe(false);
    const ok = VacancyQuery.safeParse({ day: "1", start: "08:00", end: "21:00" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.endMin - ok.data.startMin).toBe(13 * 60);
  });

  it("finds a free room from minute slots and ignores an empty timetable", () => {
    expect(minuteRangesOverlap(60, 120, 90, 150)).toBe(true);
    const rooms = [{ name: "316", capacity: 60, isLab: false }];
    expect(findAvailability(rooms, [], 1, "10:00", "11:00").free).toHaveLength(0);
    const result = findAvailability(
      rooms,
      [{ classroomName: "316", dayOfWeek: 1, startTime: "09:00", endTime: "10:00", startMin: 9 * 60, endMin: 10 * 60 }],
      1,
      "10:30",
      "11:30",
    );
    expect(result.free.map((room) => room.name)).toEqual(["316"]);
  });
});
