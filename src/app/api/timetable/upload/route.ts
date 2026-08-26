import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only .xlsx, .xls or .csv files are supported" },
        { status: 400 },
      );
    }

    try {
      const { parseTimetableWorkbook } = await import("@/lib/timetable-parser");
      const { detectHardConflicts } = await import("@/lib/ai-suggestions");
      const buffer = await file.arrayBuffer();
      let parseResult = parseTimetableWorkbook(buffer);
      parseResult = {
        ...parseResult,
        hardConflicts: detectHardConflicts(parseResult.allSlots),
        summary: {
          totalSections: parseResult.sections?.length ?? 0,
          totalSlots: parseResult.allSlots?.length ?? 0,
          totalConflicts: 0,
        },
      };
      parseResult.summary.totalConflicts = parseResult.hardConflicts?.length ?? 0;
      return NextResponse.json({ parse: parseResult, fileName: file.name });
    } catch (parserErr) {
      return NextResponse.json({
        parse: {
          sections: [],
          allSlots: [],
          hardConflicts: [],
          summary: { totalSections: 0, totalSlots: 0, totalConflicts: 0 },
          warning:
            parserErr instanceof Error
              ? parserErr.message
              : "Parser unavailable — file accepted for review",
        },
        fileName: file.name,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    );
  }
}
