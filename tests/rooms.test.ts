import { describe, expect, it } from "vitest";
import {
  buildingOf,
  canonicalRoom,
  FULL_TIMETABLE_ROOMS,
  HALL_COUNT,
  inferCampus,
  isLabRoom,
  isValidRoom,
  roomsEqual,
} from "@/lib/rooms";

describe("room list", () => {
  it("has 27 unique halls", () => {
    expect(HALL_COUNT).toBe(27);
    expect(new Set(FULL_TIMETABLE_ROOMS).size).toBe(27);
  });

  it("assigns each hall to a campus", () => {
    expect(buildingOf("316")).toBe("Aryabhatta");
    expect(buildingOf("ME-01")).toBe("Kautalya");
    expect(inferCampus("Kautalya sheet")).toBe("Kautalya");
    expect(inferCampus("SEC_A")).toBe("Aryabhatta");
  });
});

describe("isValidRoom", () => {
  it("accepts real room names", () => {
    for (const r of ["316", "10", "ME-101", "ME-01", "ME-LAB", "A-12"]) {
      expect(isValidRoom(r), r).toBe(true);
    }
  });

  it("rejects placeholders and activity codes", () => {
    for (const r of ["", "-", "TBD", "NA", "N/A", "LUNCH", "PP", "PR", "TUT", "5"]) {
      expect(isValidRoom(r), r).toBe(false);
    }
    expect(isValidRoom(null)).toBe(false);
    expect(isValidRoom(undefined)).toBe(false);
  });
});

describe("canonicalRoom", () => {
  it("normalises Kautalya shorthand", () => {
    expect(canonicalRoom("ME1")).toBe("ME-01");
    expect(canonicalRoom("me-2")).toBe("ME-02");
    expect(canonicalRoom("ME-101")).toBe("ME-101");
    expect(canonicalRoom("2", "Kautalya")).toBe("ME-02");
    expect(canonicalRoom("me lab")).toBe("ME-LAB");
  });

  it("leaves plain Aryabhatta numbers alone", () => {
    expect(canonicalRoom("316")).toBe("316");
    expect(canonicalRoom(" 404 ")).toBe("404");
  });

  it("returns null for empty or placeholder input", () => {
    expect(canonicalRoom(null)).toBeNull();
    expect(canonicalRoom("")).toBeNull();
    expect(canonicalRoom("TBD")).toBeNull();
    expect(canonicalRoom("-")).toBeNull();
  });
});

describe("roomsEqual", () => {
  it("matches spelling variants of the same room", () => {
    expect(roomsEqual("ME-01", "ME1")).toBe(true);
    expect(roomsEqual("316", " 316 ")).toBe(true);
  });

  it("separates different rooms and ignores blanks", () => {
    expect(roomsEqual("316", "317")).toBe(false);
    expect(roomsEqual(null, "316")).toBe(false);
    expect(roomsEqual("316", "")).toBe(false);
  });
});

describe("isLabRoom", () => {
  it("flags known labs and anything named LAB", () => {
    expect(isLabRoom("105")).toBe(true);
    expect(isLabRoom("ME-LAB")).toBe(true);
    expect(isLabRoom("Physics Lab")).toBe(true);
  });

  it("does not flag ordinary halls", () => {
    expect(isLabRoom("316")).toBe(false);
    expect(isLabRoom(null)).toBe(false);
  });
});
