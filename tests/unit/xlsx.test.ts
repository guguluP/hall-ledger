import { deflateRawSync } from "zlib";
import { describe, expect, it } from "vitest";
import { xlsxToCsv } from "@/lib/parse/xlsx";
import { sheetsExportUrl } from "@/lib/sheets";
import { parseTimetableCsv } from "@/lib/parse/timetable";

function zip(files: Record<string, string>) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text));
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(Buffer.byteLength(text), 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const localRecord = Buffer.concat([local, nameBytes, data]);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(Buffer.byteLength(text), 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(localRecord);
    centrals.push(Buffer.concat([central, nameBytes]));
    offset += localRecord.length;
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, centralDir, eocd]));
}

describe("workbook import", () => {
  it("reads cell text from a plain xlsx and refuses a non-Google link", () => {
    const book = zip({
      "xl/sharedStrings.xml": "<sst><si><t>Section</t></si><si><t>Day</t></si><si><t>Start</t></si><si><t>End</t></si><si><t>Subject</t></si><si><t>Room</t></si><si><t>SECTION-A</t></si><si><t>Monday</t></si><si><t>Physics</t></si></sst>",
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData>
        <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="s"><v>5</v></c>
        <c r="A2" t="s"><v>6</v></c><c r="B2" t="s"><v>7</v></c><c r="C2"><v>09:30</v></c><c r="D2"><v>10:30</v></c><c r="E2" t="s"><v>8</v></c><c r="F2"><v>316</v></c>
      </sheetData></worksheet>`,
    });
    const parsed = parseTimetableCsv(xlsxToCsv(book), { knownRooms: ["316"] });
    expect(parsed.slots[0]).toMatchObject({ section: "SECTION-A", room: "316", startMin: 9 * 60 + 30 });
    expect(sheetsExportUrl("https://docs.google.com/spreadsheets/d/abc_DEF-123/edit#gid=0")).toBe(
      "https://docs.google.com/spreadsheets/d/abc_DEF-123/export?format=csv",
    );
    expect(() => sheetsExportUrl("https://example.com/spreadsheets/d/abc/export")).toThrow(/docs\.google\.com/);
  });
});
