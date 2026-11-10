import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireVisible } from "@/lib/auth/authz";
import { findAvailability } from "@/lib/occupancy";
import { getPublished } from "@/lib/published";
import { prisma } from "@/lib/prisma";
import { roomKey } from "@/lib/rooms";
import { applyDatedChanges, campusNote, dayOfDate, istNow, type ChangeRow } from "@/lib/schedule";
import { vacancyCounts, VacancyQuery } from "@/lib/schemas";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function flag(value: string | null) {
  return value === "1";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const inst = await requireVisible(slug);
    const now = istNow();
    const live = flag(req.nextUrl.searchParams.get("now"));
    const dateParam = req.nextUrl.searchParams.get("date") || "";
    const dated = dayOfDate(dateParam) == null ? null : dateParam;
    const day = live ? now.day : dated ? dayOfDate(dated)! : undefined;
    if (live && now.minutes >= inst.dayEndMin) {
      return json(inst.isPublic, {
        rooms: [],
        partial: [],
        ...vacancyCounts(0, 0),
        closed: true,
        exam: false,
        reason: "The building is closed for today, so no room is free to use.",
        source: "published",
        day: now.day,
        date: now.date,
      });
    }
    const liveStart = Math.min(Math.max(now.minutes, inst.dayStartMin), inst.dayEndMin - 1);
    const parsed = VacancyQuery.safeParse({
      day: day == null ? (req.nextUrl.searchParams.get("day") ?? "") : String(day),
      start: live ? fromMinutes(liveStart) : (req.nextUrl.searchParams.get("start") ?? ""),
      end: live ? fromMinutes(inst.dayEndMin) : (req.nextUrl.searchParams.get("end") ?? ""),
      labs: req.nextUrl.searchParams.get("labs") === "1" ? "1" : "0",
    });
    if (!parsed.success) return apiError(parsed.error);
    const published = await getPublished(inst.id);
    const note = campusNote({
      day: parsed.data.day,
      date: live ? now.date : dated,
      sundayOpen: inst.sundayOpen,
      closures: live || dated ? await prisma.closure.findMany({ where: { institutionId: inst.id } }) : [],
    });
    const seatsRaw = Number(req.nextUrl.searchParams.get("seats") || "");
    let seats = Number.isInteger(seatsRaw) && seatsRaw > 0 ? seatsRaw : 0;
    const section = (req.nextUrl.searchParams.get("section") || "").trim();
    if (section) {
      const strength = published.strengths.find((row) => row.section === section);
      if (strength) seats = Math.max(seats, strength.students);
    }
    const floorRaw = req.nextUrl.searchParams.get("floor");
    const floor = floorRaw != null && floorRaw !== "" ? Number(floorRaw) : null;
    const pool = published.rooms.filter((room) => {
      if (parsed.data.labs && !room.isLab) return false;
      if (seats && (room.capacity == null || room.capacity < seats)) return false;
      if (flag(req.nextUrl.searchParams.get("projector")) && !room.hasProjector) return false;
      if (flag(req.nextUrl.searchParams.get("board")) && !room.hasSmartBoard) return false;
      if (flag(req.nextUrl.searchParams.get("ac")) && !room.hasAc) return false;
      if (floor != null && room.floor !== floor) return false;
      return true;
    });
    if (note.closed) {
      const body = { rooms: [], partial: [], ...vacancyCounts(0, 0), closed: true, exam: false, reason: note.reason, source: published.source, day: parsed.data.day };
      return json(inst.isPublic, body);
    }
    const when = live ? now.date : dated;
    const changes: ChangeRow[] = when
      ? await prisma.scheduleChange.findMany({ where: { institutionId: inst.id, date: when } })
      : [];
    const bookings = when
      ? await prisma.bookingRequest.findMany({ where: { institutionId: inst.id, date: when, status: "APPROVED" } })
      : [];
    const reports = await prisma.crowdReport.findMany({
      where: { institutionId: inst.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    const activeReports = new Map<string, string>();
    for (const report of reports) {
      if (!activeReports.has(report.roomKey)) activeReports.set(report.roomKey, report.kind);
    }
    const slots = applyDatedChanges(published.slots, parsed.data.day, changes, bookings.map((booking) => ({
      roomName: booking.roomName,
      startMin: booking.startMin,
      endMin: booking.endMin,
      purpose: booking.purpose,
    })), { pauseWeekly: note.exam });
    const start = fromMinutes(parsed.data.startMin);
    const end = fromMinutes(parsed.data.endMin);
    const { free, partial } = findAvailability(pool, slots, parsed.data.day, start, end, false);
    const stamp = (room: (typeof free)[number]) => ({
      ...room,
      report: activeReports.get(roomKey(room.name)) || null,
      freeForMin: live ? Math.max(0, room.freeUntilMin - liveStart) : null,
    });
    return json(inst.isPublic, {
      rooms: free.map(stamp),
      partial: partial.map(stamp),
      ...vacancyCounts(pool.length, free.length),
      closed: false,
      exam: note.exam,
      reason: note.reason,
      source: published.source,
      fileName: published.fileName,
      day: parsed.data.day,
      date: when,
      start,
      end,
      interpretedPm: false,
    });
  } catch (error) {
    return apiError(error);
  }
}

function json(isPublic: boolean, body: unknown) {
  const response = NextResponse.json(body);
  if (isPublic) response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
