import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FULL_TIMETABLE_ROOMS } from "@/lib/rooms";

/**
 * GET /api/timetable/grid
 * Always returns the full 1st-year room set (26 halls), merged with any
 * extra names that appear in published slots. Never caps at 5–8 seed rooms.
 */
export async function GET() {
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: { status: { not: "CANCELLED" } },
      include: {
        classroom: true,
        section: true,
        subject: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const usage = new Map<string, number>();
    for (const s of slots) {
      const name = s.classroom?.name;
      if (!name) continue;
      usage.set(name, (usage.get(name) || 0) + 1);
    }

    const nameSet = new Set<string>([...FULL_TIMETABLE_ROOMS]);
    for (const name of usage.keys()) nameSet.add(name);

    const rooms = [...nameSet]
      .map((name) => ({
        name,
        building: name.toUpperCase().startsWith("ME") ? "Kautalya" : "Aryabhatta",
        capacity: 60,
        usage: usage.get(name) || 0,
      }))
      .sort((a, b) => {
        if (b.usage !== a.usage) return b.usage - a.usage;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });

    return NextResponse.json({
      slots: slots.map((s) => ({
        classroomName: s.classroom?.name ?? "",
        sectionName: s.section?.name ?? null,
        subjectName: s.subject?.name ?? null,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      rooms: rooms.map(({ name, building, capacity }) => ({
        name,
        building,
        capacity,
      })),
      stats: {
        slots: slots.length,
        rooms: rooms.length,
        roomsInUse: usage.size,
      },
    });
  } catch (e) {
    return NextResponse.json({
      slots: [],
      rooms: FULL_TIMETABLE_ROOMS.map((name) => ({
        name,
        building: name.startsWith("ME") ? "Kautalya" : "Aryabhatta",
        capacity: 60,
      })),
      stats: {
        slots: 0,
        rooms: FULL_TIMETABLE_ROOMS.length,
        roomsInUse: 0,
      },
      warning: e instanceof Error ? e.message : "Database unavailable",
    });
  }
}
