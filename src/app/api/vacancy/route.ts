import { NextRequest, NextResponse } from "next/server";
import { buildingOf, FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { loadPublished } from "@/lib/published-store";
import { findFreeRooms } from "@/lib/occupancy";
import { padTime, toMinutes } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const day = Number(url.searchParams.get("day") || "1");
    const start = padTime(url.searchParams.get("start") || "10:30");
    const end = padTime(url.searchParams.get("end") || "12:30");
    const labsOnly = url.searchParams.get("labs") === "1";

    if (toMinutes(end) <= toMinutes(start)) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    const published = await loadPublished().catch(() => null);
    const slots = published?.slots ?? [];
    const baseRooms =
      published?.rooms && published.rooms.length > 0
        ? published.rooms
        : FULL_TIMETABLE_ROOMS.map((name) => ({
            name,
            building: buildingOf(name),
            capacity: 60,
          }));

    const rooms = baseRooms.map((r) => ({
      name: r.name,
      building: r.building || buildingOf(r.name),
      capacity: typeof r.capacity === "number" ? r.capacity : 60,
    }));

    const free = findFreeRooms(rooms, slots, day, start, end, labsOnly);

    return NextResponse.json({
      rooms: free,
      total: rooms.length,
      free: free.length,
      occupied: rooms.length - free.length,
      source: slots.length > 0 ? "published" : "empty",
      day,
      start,
      end,
    });
  } catch (e) {
    console.error("[vacancy]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Vacancy search failed" },
      { status: 500 },
    );
  }
}
