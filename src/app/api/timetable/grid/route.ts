import { NextResponse } from "next/server";
import { buildingOf, FULL_TIMETABLE_ROOMS } from "@/lib/rooms";
import { loadPublished } from "@/lib/published-store";
import { padTime } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyGrid() {
  return {
    slots: [] as const,
    rooms: FULL_TIMETABLE_ROOMS.map((name) => ({ name, building: buildingOf(name), capacity: 60 })),
    stats: { slots: 0, rooms: FULL_TIMETABLE_ROOMS.length, roomsInUse: 0, sections: 0, conflicts: 0 },
    source: "empty" as const,
    warning: "No published timetable yet. Upload and Publish from the Upload page.",
  };
}

export async function GET() {
  try {
    const published = await loadPublished();
    if (published?.slots?.length) {
      return NextResponse.json({
        slots: published.slots.map((s) => ({ ...s, startTime: padTime(s.startTime), endTime: padTime(s.endTime) })),
        rooms: published.rooms.length ? published.rooms : FULL_TIMETABLE_ROOMS.map((name) => ({ name, building: buildingOf(name), capacity: 60 })),
        stats: published.stats, source: "published", publishedAt: published.publishedAt, fileName: published.fileName,
      });
    }
  } catch (e) {
    console.warn("[grid] published read failed", e);
  }
  try {
    const { prisma } = await import("@/lib/prisma");
    const slots = await prisma.timetableSlot.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { classroom: true, section: true, subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    if (slots.length) {
      const usage = new Map<string, number>();
      for (const s of slots) {
        const name = s.classroom?.name;
        if (!name) continue;
        usage.set(name, (usage.get(name) || 0) + 1);
      }
      const nameSet = new Set<string>([...FULL_TIMETABLE_ROOMS]);
      for (const name of usage.keys()) nameSet.add(name);
      const rooms = [...nameSet].map((name) => ({ name, building: buildingOf(name), capacity: 60, usage: usage.get(name) || 0 }))
        .sort((a, b) => (b.usage !== a.usage ? b.usage - a.usage : a.name.localeCompare(b.name, undefined, { numeric: true })));
      return NextResponse.json({
        slots: slots.map((s) => ({
          classroomName: s.classroom?.name ?? "", sectionName: s.section?.name ?? null, subjectName: s.subject?.name ?? null,
          dayOfWeek: s.dayOfWeek, startTime: padTime(s.startTime), endTime: padTime(s.endTime),
        })),
        rooms: rooms.map(({ name, building, capacity }) => ({ name, building, capacity })),
        stats: { slots: slots.length, rooms: rooms.length, roomsInUse: usage.size, sections: new Set(slots.map((s) => s.section?.name).filter(Boolean)).size, conflicts: 0 },
        source: "database",
      });
    }
  } catch (e) {
    console.warn("[grid] prisma failed", e);
  }
  return NextResponse.json(emptyGrid());
}
