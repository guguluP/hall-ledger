import { NextRequest, NextResponse } from "next/server";
import { parseTimetableWorkbook } from "@/lib/timetable-parser";
import { detectHardConflicts } from "@/lib/hard-conflicts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only .xlsx, .xls or .csv files are supported" },
        { status: 400 },
      );
    }

    const buffer = await file.arrayBuffer();
    let parseResult = parseTimetableWorkbook(buffer);
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

    return NextResponse.json({
      parse: parseResult,
      fileName: file.name,
    });
  } catch (e) {
    console.error("[timetable/upload]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Could not parse workbook. Check it matches the 2025-26 multi-sheet format.",
      },
      { status: 500 },
    );
  }
}
