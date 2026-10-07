import { describe, expect, it } from "vitest";
import {
  coversStart,
  fromMinutes,
  labelTime,
  normalizeWindow,
  padTime,
  parseTimeToMinutes,
  rangesOverlap,
  slotEndMinutes,
  slotMinutes,
} from "@/lib/time";

describe("parseTimeToMinutes", () => {
  it("parses 24-hour times with : or . separators", () => {
    expect(parseTimeToMinutes("9:30")).toBe(570);
    expect(parseTimeToMinutes("09.30")).toBe(570);
    expect(parseTimeToMinutes("13:45")).toBe(825);
  });

  it("parses 12-hour times with a meridian", () => {
    expect(parseTimeToMinutes("5:30 PM")).toBe(1050);
    expect(parseTimeToMinutes("5:30pm")).toBe(1050);
    expect(parseTimeToMinutes("12:00 AM")).toBe(0);
    expect(parseTimeToMinutes("12:30 PM")).toBe(750);
  });

  it("returns -1 for anything it cannot read", () => {
    expect(parseTimeToMinutes("")).toBe(-1);
    expect(parseTimeToMinutes("abc")).toBe(-1);
    expect(parseTimeToMinutes("25:00")).toBe(-1);
    expect(parseTimeToMinutes("10:75")).toBe(-1);
    expect(parseTimeToMinutes("13:00 PM")).toBe(-1);
  });

  it("treats 24:00 as midnight and rejects 24:30", () => {
    expect(parseTimeToMinutes("24:00")).toBe(0);
    expect(parseTimeToMinutes("24:30")).toBe(-1);
  });

  it("assumes PM for 1:00-6:59 only when asked", () => {
    expect(parseTimeToMinutes("1:30")).toBe(90);
    expect(parseTimeToMinutes("1:30", { assumeAfternoon: true })).toBe(810);
    expect(parseTimeToMinutes("9:30", { assumeAfternoon: true })).toBe(570);
    expect(parseTimeToMinutes("7:00", { assumeAfternoon: true })).toBe(420);
  });
});

describe("formatting helpers", () => {
  it("pads and normalises times", () => {
    expect(padTime("9:30")).toBe("09:30");
    expect(padTime("5:30 PM")).toBe("17:30");
    expect(padTime("garbage")).toBe("garbage");
  });

  it("wraps minutes around midnight", () => {
    expect(fromMinutes(570)).toBe("09:30");
    expect(fromMinutes(24 * 60 + 5)).toBe("00:05");
    expect(fromMinutes(-60)).toBe("23:00");
  });

  it("labels times for display", () => {
    expect(labelTime("13:30")).toBe("1:30 PM");
    expect(labelTime("00:15")).toBe("12:15 AM");
    expect(labelTime(570)).toBe("9:30 AM");
    expect(labelTime("12:00")).toBe("12:00 PM");
  });
});

describe("slot minutes", () => {
  it("reads bare afternoon hours in timetable slots as PM", () => {
    expect(slotMinutes("1:30")).toBe(810);
    expect(slotMinutes("09:30")).toBe(570);
  });

  it("computes slot ends and falls back to one period", () => {
    expect(slotEndMinutes("13:30", "14:30")).toBe(870);
    expect(slotEndMinutes("09:30", "")).toBe(630);
    expect(slotEndMinutes("nonsense", "10:30")).toBe(-1);
  });

  it("repairs an end time that reads earlier than the start", () => {
    // 12:30 → 1:30 means 13:30, not 01:30
    expect(slotEndMinutes("12:30", "1:30")).toBe(810);
  });
});

describe("normalizeWindow", () => {
  it("keeps a normal morning window as written", () => {
    const w = normalizeWindow("10:30", "12:30");
    expect(w).toMatchObject({ start: "10:30", end: "12:30", interpretedPm: false });
  });

  it("reads a too-early end as PM (9:30 → 5:30 is the college day)", () => {
    const w = normalizeWindow("09:30", "5:30");
    expect(w).toMatchObject({ start: "09:30", end: "17:30", interpretedPm: true });
    expect(w!.endMin - w!.startMin).toBe(480);
  });

  it("rejects unreadable times and windows longer than 12 hours", () => {
    expect(normalizeWindow("bad", "10:00")).toBeNull();
    expect(normalizeWindow("10:00", "bad")).toBeNull();
    expect(normalizeWindow("00:00", "13:00")).toBeNull();
  });
});

describe("rangesOverlap", () => {
  it("does not treat back-to-back periods as overlapping", () => {
    expect(rangesOverlap("09:30", "10:30", "10:30", "11:30")).toBe(false);
  });

  it("detects real overlap", () => {
    expect(rangesOverlap("09:30", "11:00", "10:30", "11:30")).toBe(true);
  });

  it("compares bare afternoon hours against 24-hour times", () => {
    expect(rangesOverlap("1:30", "2:30", "13:30", "14:30")).toBe(true);
  });

  it("returns false when any time is unreadable", () => {
    expect(rangesOverlap("??", "10:30", "10:00", "11:00")).toBe(false);
  });
});

describe("coversStart", () => {
  it("includes the start and excludes the end", () => {
    expect(coversStart("09:30", "10:30", "09:30")).toBe(true);
    expect(coversStart("09:30", "10:30", "10:00")).toBe(true);
    expect(coversStart("09:30", "10:30", "10:30")).toBe(false);
    expect(coversStart("09:30", "10:30", "09:00")).toBe(false);
  });
});
