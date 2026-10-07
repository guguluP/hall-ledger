import { describe, expect, it } from "vitest";
import {
  buildTimeRows,
  findAvailability,
  findFreeRooms,
  findSlot,
  type OccupancySlot,
} from "@/lib/occupancy";

const rooms = [{ name: "316" }, { name: "317" }, { name: "105" }];

function booked(over: Partial<OccupancySlot>): OccupancySlot {
  return {
    classroomName: "316",
    sectionName: "SECTION-A",
    subjectName: "Maths",
    dayOfWeek: 1,
    startTime: "10:30",
    endTime: "11:30",
    ...over,
  };
}

describe("findAvailability", () => {
  it("never claims rooms are free when there is no timetable", () => {
    const out = findAvailability(rooms, [], 1, "10:30", "12:30");
    expect(out.free).toEqual([]);
    expect(out.partial).toEqual([]);
  });

  it("separates fully free halls from partly free ones", () => {
    const { free, partial } = findAvailability(rooms, [booked({})], 1, "10:30", "12:30");
    expect(free.map((r) => r.name).sort()).toEqual(["105", "317"]);
    expect(partial.map((r) => r.name)).toEqual(["316"]);
    expect(partial[0].freeFrom).toBe("11:30 AM");
    expect(partial[0].freeUntil).toBe("12:30 PM");
  });

  it("treats a class that ends exactly at the window start as no conflict", () => {
    const slots = [booked({ startTime: "09:30", endTime: "10:30" })];
    const { free } = findAvailability(rooms, slots, 1, "10:30", "11:30");
    expect(free.map((r) => r.name)).toContain("316");
  });

  it("only blocks the day the class is on", () => {
    const { free } = findAvailability(rooms, [booked({ dayOfWeek: 2 })], 1, "10:30", "11:30");
    expect(free.map((r) => r.name)).toContain("316");
  });

  it("blocks afternoon slots written without AM/PM", () => {
    const slots = [booked({ startTime: "1:30", endTime: "2:30" })];
    const { free } = findAvailability(rooms, slots, 1, "13:30", "14:30");
    expect(free.map((r) => r.name)).not.toContain("316");
  });

  it("reads a 9:30 → 5:30 search as the whole college day", () => {
    const slots = [booked({ startTime: "16:30", endTime: "17:30" })];
    const { free, partial } = findAvailability(rooms, slots, 1, "09:30", "5:30");
    expect(free.map((r) => r.name)).not.toContain("316");
    expect(partial.map((r) => r.name)).toContain("316");
  });

  it("returns nothing for an unreadable window", () => {
    const out = findAvailability(rooms, [booked({})], 1, "nonsense", "12:30");
    expect(out.free).toEqual([]);
    expect(out.partial).toEqual([]);
  });

  it("limits results to labs when asked", () => {
    const slots = [booked({ classroomName: "999", dayOfWeek: 3 })];
    const free = findFreeRooms(rooms, slots, 1, "10:30", "11:30", true);
    expect(free.map((r) => r.name)).toEqual(["105"]);
    expect(free[0].isLab).toBe(true);
  });

  it("names the next booking after a free window", () => {
    const slots = [booked({ startTime: "13:30", endTime: "14:30", classroomName: "317" })];
    const { free } = findAvailability(rooms, slots, 1, "10:30", "11:30");
    const r317 = free.find((r) => r.name === "317");
    expect(r317?.nextBooking).toContain("1:30 PM");
    expect(r317?.nextBooking).toContain("SECTION-A");
  });
});

describe("findSlot", () => {
  it("finds the class running at a given start time", () => {
    const s = booked({});
    expect(findSlot([s], "316", 1, "10:30")).toBe(s);
    expect(findSlot([s], "316", 1, "11:30")).toBeUndefined();
    expect(findSlot([s], "317", 1, "10:30")).toBeUndefined();
  });
});

describe("buildTimeRows", () => {
  it("falls back to a 9:30–4:30 day when there are no slots", () => {
    const rows = buildTimeRows([]);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({ start: "09:30", label: "9:30 AM" });
    expect(rows[7].start).toBe("16:30");
  });

  it("covers the span of the data", () => {
    const rows = buildTimeRows([booked({ startTime: "09:30", endTime: "10:30" }), booked({ startTime: "15:30", endTime: "17:30" })]);
    expect(rows[0].start).toBe("09:30");
    expect(rows[rows.length - 1].start).toBe("16:30");
  });
});
