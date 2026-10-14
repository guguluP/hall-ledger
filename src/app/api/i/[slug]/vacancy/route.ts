import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireVisible } from "@/lib/auth/authz";
import { findAvailability } from "@/lib/occupancy";
import { getPublished } from "@/lib/published";
import { VacancyQuery } from "@/lib/schemas";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const inst = await requireVisible(slug);
    const parsed = VacancyQuery.safeParse({
      day: req.nextUrl.searchParams.get("day") ?? "",
      start: req.nextUrl.searchParams.get("start") ?? "",
      end: req.nextUrl.searchParams.get("end") ?? "",
      labs: req.nextUrl.searchParams.get("labs") === "1" ? "1" : "0",
    });
    if (!parsed.success) {
      return apiError(parsed.error);
    }
    const published = await getPublished(inst.id);
    const start = fromMinutes(parsed.data.startMin);
    const end = fromMinutes(parsed.data.endMin);
    const { free, partial } = findAvailability(
      published.rooms.map((room) => ({ ...room, building: room.building || undefined })),
      published.slots,
      parsed.data.day,
      start,
      end,
      parsed.data.labs,
    );
    return NextResponse.json({
      rooms: free,
      partial,
      total: published.rooms.length,
      free: free.length,
      occupied: Math.max(0, published.rooms.length - free.length),
      source: published.source,
      fileName: published.fileName,
      day: parsed.data.day,
      start,
      end,
      interpretedPm: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
