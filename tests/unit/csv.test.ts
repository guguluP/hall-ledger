import { describe, expect, it } from "vitest";
import { CsvError, decodeUtf8, parseCsv } from "@/lib/parse/csv";

describe("csv", () => {
  it("reads quotes, escaped quotes, and embedded newlines", () => {
    const rows = parseCsv('a,"b,c","say ""hi""",d\n"line1\nline2",e\n');
    expect(rows).toEqual([
      ["a", "b,c", 'say "hi"', "d"],
      ["line1\nline2", "e"],
    ]);
  });

  it("strips a BOM and accepts semicolon or tab delimiters", () => {
    expect(parseCsv("\uFEFFa;b\n1;2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a\tb\n1\t2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("rejects invalid UTF-8", () => {
    expect(() => decodeUtf8(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(CsvError);
  });

  it("enforces row, column, and cell limits", () => {
    expect(() => parseCsv("x".repeat(501))).toThrow(/500 characters/);
    const wide = Array.from({ length: 61 }, () => "a").join(",");
    expect(() => parseCsv(wide)).toThrow(/60 columns/);
    const tall = Array.from({ length: 2001 }, () => "a").join("\n");
    expect(() => parseCsv(tall)).toThrow(/2000 rows/);
  });
});
