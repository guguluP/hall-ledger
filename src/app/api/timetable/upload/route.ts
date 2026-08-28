import { NextRequest, NextResponse } from "next/server";
import { parseTimetableWorkbook } from "@/lib/timetable-parser";
import { detectHardConflicts } from "@/lib/hard-conflicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK_EXT = /\.(xlsx|xlsm|xls|csv|tsv|ods|html|htm)$/i;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const name = file.name || "timetable.xlsx";
    if (name.includes(".") && !OK_EXT.test(name)) {
      return NextResponse.json(
        {
          error:
            "Use an Excel, CSV, TSV, ODS or HTML timetable (.xlsx .xlsm .xls .csv .tsv .ods)",
        },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Second arg is optional for older parser builds
    let parseResult = (parseTimetableWorkbook as (b: ArrayBuffer, n?: string) => ReturnType<typeof parseTimetableWorkbook>)(
      buffer,
      name,
    );
    const hardConflicts = detectHardConflicts(parseResult.allSlots);
    parseResult = {
      ...parseResult,
      hardConflicts,
      summary: {
        ...parseResult.summary,
        totalConflicts: hardConflicts.length,
        totalSections:
          parseResult.sections?.length ?? parseResult.summary?.totalSections ?? 0,
        totalSlots:
          parseResult.allSlots?.length ?? parseResult.summary?.totalSlots ?? 0,
      },
    };

    if (!parseResult.allSlots.length) {
      return NextResponse.json(
        {
          error:
            "Could not find day/time cells in this file. Use sheets with day names and time headings, or a Day / Time / Subject / Room table.",
          parse: parseResult,
          fileName: name,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      parse: parseResult,
      fileName: name,
    });
  } catch (e) {
    console.error("[timetable/upload]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not read this file. Try .xlsx, .xls, .csv or .ods with day names and time headings.",
      },
      { status: 500 },
    );
  }
}
