import { NextRequest, NextResponse } from "next/server";
import { FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { savePublished, slotsFromParse, roomsFromSlots } from "@/lib/published-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = body?.parse;
    if (!parse) return NextResponse.json({ error: "Missing parse payload" }, { status: 400 });
    const slots = slotsFromParse(parse);
    if (!slots.length) return NextResponse.json({ error: "Nothing to publish \u2014 parse the file first." }, { status: 400 });
    const rooms = roomsFromSlots(slots, FULL_TIMETABLE_ROOMS);
    const sections = parse.sections?.length ?? new Set(slots.map((s) => s.sectionName).filter(Boolean)).size;
    const conflicts = parse.hardConflicts?.length ?? parse.summary?.totalConflicts ?? 0;
    const payload = {
      publishedAt: new Date().toISOString(),
      fileName: (body.fileName as string | undefined) || undefined,
      slots, rooms,
      stats: {
        sections: Number(sections) || 0, slots: slots.length, rooms: rooms.length,
        roomsInUse: new Set(slots.map((s) => s.classroomName).filter(Boolean)).size,
        conflicts: Number(conflicts) || 0,
      },
    };
    await savePublished(payload);
    return NextResponse.json({
      message: `Published ${payload.stats.slots} slots across ${payload.stats.sections} sections.`,
      stats: payload.stats, payload,
    });
  } catch (e) {
    console.error("[publish]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed" }, { status: 500 });
  }
}
