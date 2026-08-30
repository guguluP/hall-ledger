import { NextRequest, NextResponse } from "next/server";
import { buildingOf, FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { loadPublished } from "@/lib/published-store";
import { findAvailability } from "@/lib/occupancy";
import { normalizeWindow } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const day = Number(url.searchParams.get("day") || "1");
    const startRaw = url.searchParams.get("start") || "10:30";
    const endRaw = url.searchParams.get("end") || "12:30";
    const labsOnly = url.searchParams.get("labs") === "1";

    const win = normalizeWindow(startRaw, endRaw);
    if (!win) {
      return NextResponse.json(
        { error: "End time must be after start time. Afternoon hours are PM (5:30 = 5:30 PM)." },
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

    const { free, partial } = findAvailability(rooms, slots, day, win.start, win.end, labsOnly);

    return NextResponse.json({
      rooms: free,
      partial,
      total: rooms.length,
      free: free.length,
      occupied: Math.max(0, rooms.length - free.length),
      source: slots.length > 0 ? "published" : "empty",
      day,
      start: win.start,
      end: win.end,
      interpretedPm: win.interpretedPm,
    });
  } catch (e) {
    console.error("[vacancy]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Vacancy search failed" },
      { status: 500 },
    );
  }
}
