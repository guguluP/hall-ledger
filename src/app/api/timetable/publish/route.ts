import { NextRequest, NextResponse } from "next/server";
import { FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { savePublished, slotsFromParse, roomsFromSlots } from "@/lib/published-store";
import { checkPublishAuth } from "@/lib/publish-auth";
import { declaredTooLarge, maxPublishBytes } from "@/lib/limits";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = checkPublishAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rl = rateLimit(`publish:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many publish requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    if (declaredTooLarge(req, maxPublishBytes())) {
      return NextResponse.json({ error: "Publish payload is too large." }, { status: 413 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
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
    return NextResponse.json({ error: publicError(e, "Publish failed") }, { status: 500 });
  }
}
