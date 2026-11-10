import { describe, expect, it } from "vitest";
import { normalizeWindow, parseClassRange, parseTimeToMinutes, slotEndMinutes, slotMinutes } from "@/lib/time";
import { isLabToken, roomsEqual } from "@/lib/rooms";
import { vacancyCounts } from "@/lib/schemas";
import { matchSchools } from "@/lib/auth/service";
import { parsePlainQuery } from "@/lib/query";
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
    expect(VacancyQuery.safeParse({ day: "", start: "10:00", end: "11:00" }).success).toBe(false);
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

  it("reads 6:00–7:00 and 5:30–6:30 as afternoon in both parsers", () => {
    const evening = parseClassRange("6:00-7:00");
    const late = parseClassRange("5:30-6:30");
    expect(evening).toMatchObject({ startMin: 18 * 60, endMin: 19 * 60 });
    expect(late).toMatchObject({ startMin: 17 * 60 + 30, endMin: 18 * 60 + 30 });
    expect(slotMinutes("6:00")).toBe(18 * 60);
    expect(slotMinutes("7:00")).toBe(19 * 60);
    expect(slotEndMinutes("6:00", "7:00")).toBe(19 * 60);
    expect(slotEndMinutes("5:30", "6:30")).toBe(18 * 60 + 30);
    expect(parseClassRange("6:00 AM-7:00 AM")).toMatchObject({ startMin: 6 * 60, endMin: 7 * 60 });
    expect(parseTimeToMinutes("09:30")).toBe(9 * 60 + 30);
  });

  it("counts labs separately and matches school names without case", () => {
    expect(vacancyCounts(2, 0)).toEqual({ total: 2, free: 0, occupied: 2 });
    expect(isLabToken("Collab-1")).toBe(false);
    expect(isLabToken("ME-LAB")).toBe(true);
    expect(roomsEqual("LH 1", "LH1")).toBe(true);
    expect(matchSchools([{ name: "Aryabhatta", slug: "arya" }], "aryabhatta")).toHaveLength(1);
    expect(parsePlainQuery("lab for 40, Tue 2-4")).toMatchObject({ labs: true, seats: 40, day: 2, start: "14:00", end: "16:00" });
  });
});
