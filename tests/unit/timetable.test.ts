import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseTimetableCsv } from "@/lib/parse/timetable";

const root = path.resolve(__dirname, "../..");

describe("timetable parser", () => {
  it("reads a tabular file and a Day/Time/Subject/Room file", () => {
    const tabular = parseTimetableCsv(
      "Section,Day,Start,End,Subject,Room,Type\nSECTION-A,Monday,09:30,10:30,Physics,316,PP\n",
      { knownRooms: ["316"] },
    );
    expect(tabular.slots).toHaveLength(1);
    expect(tabular.slots[0].startMin).toBe(9 * 60 + 30);
    expect(tabular.warnings).toHaveLength(0);

    const timeColumn = parseTimetableCsv(
      "Day,Time,Subject,Room\nMonday,10:00-11:00,Algebra,316\n",
      { knownRooms: ["316"], fileName: "sec_b.csv" },
    );
    expect(timeColumn.slots[0].section).toBe("SECTION-B");
    expect(timeColumn.slots[0].endMin).toBe(11 * 60);
  });

  it("reads the grid fixture", () => {
    const text = readFileSync(path.join(root, "public/samples/timetable-template.csv"), "utf8");
    const parsed = parseTimetableCsv(text, { knownRooms: ["316", "304", "10", "404", "107"] });
    expect(parsed.slots.some((slot) => slot.section === "SECTION-A" && slot.dayOfWeek === 1)).toBe(true);
    expect(parsed.slots.length).toBeGreaterThan(4);
  });

  it("parses the sample export into 340 slots and 35 conflicts", () => {
    const text = readFileSync(path.join(root, "public/samples/sample-timetable.csv"), "utf8");
    const fixture = JSON.parse(readFileSync(path.join(root, "prisma/fixtures/default-timetable.json"), "utf8")) as {
      rooms: { name: string }[];
    };
    const parsed = parseTimetableCsv(text, { knownRooms: fixture.rooms.map((room) => room.name) });
    expect(parsed.slots).toHaveLength(340);
    expect(parsed.hardConflicts).toHaveLength(35);
  });

  it("skips a section name longer than 40 characters", () => {
    const name = "S".repeat(45);
    const parsed = parseTimetableCsv(
      `Section,Day,Start,End,Subject,Room\n${name},Monday,09:30,10:30,Math,316\n`,
      { knownRooms: ["316"] },
    );
    expect(parsed.slots).toHaveLength(0);
    expect(parsed.warnings.join(" ")).toMatch(/40 characters/);
  });

  it("warns on an unknown room and does not remap it", () => {
    const parsed = parseTimetableCsv(
      "Section,Day,Start,End,Subject,Room\nSECTION-A,Monday,09:30,10:30,Lab,101\n",
      { knownRooms: ["316"] },
    );
    expect(parsed.slots[0].room).toBe("101");
    expect(parsed.warnings.join(" ")).toMatch(/Unknown room "101"/);
  });
});
