import { NextResponse } from "next/server";
import { loadPublished } from "@/lib/published-store";

export const dynamic = "force-dynamic";

/**
 * Seed-first health check.
 * The app serves the bundled timetable (or the latest publish) without a
 * database, so health reflects that store, not Prisma. Failures return a
 * generic message; details go to server logs only.
 */
export async function GET() {
  try {
    const published = await loadPublished();
    const slots = published?.slots?.length ?? 0;
    return NextResponse.json(
      {
        ok: slots > 0,
        store: published?.origin ?? "seed",
        slots,
        sections: published?.stats?.sections ?? 0,
        rooms: published?.rooms?.length ?? 0,
      },
      { status: slots > 0 ? 200 : 503 },
    );
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json({ ok: false, error: "Timetable store unavailable" }, { status: 503 });
  }
}
