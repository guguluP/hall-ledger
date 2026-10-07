import { NextRequest, NextResponse } from "next/server";
import { parseTimetableWorkbook } from "@/lib/timetable-parser";
import { detectHardConflicts } from "@/lib/hard-conflicts";
import { declaredTooLarge, formatBytes, maxUploadBytes } from "@/lib/limits";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK_EXT = /\.(xlsx|xlsm|xls|csv|tsv|ods|html|htm)$/i;

// Multipart framing adds a little overhead on top of the file itself.
const MULTIPART_SLACK_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`upload:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many uploads. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const maxBytes = maxUploadBytes();
    const tooLargeMessage = `File is too large. Maximum size is ${formatBytes(maxBytes)}.`;
    if (declaredTooLarge(req, maxBytes + MULTIPART_SLACK_BYTES)) {
      return NextResponse.json({ error: tooLargeMessage }, { status: 413 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json({ error: tooLargeMessage }, { status: 413 });
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
        error: publicError(
          e,
          "Could not read this file. Try .xlsx, .xls, .csv or .ods with day names and time headings.",
        ),
      },
      { status: 500 },
    );
  }
}
