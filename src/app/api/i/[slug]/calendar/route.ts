import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireVisible } from "@/lib/auth/authz";
import { icsFor } from "@/lib/ics";
import { getPublished } from "@/lib/published";
import { prisma } from "@/lib/prisma";
import { istNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const inst = await requireVisible(slug);
    const published = await getPublished(inst.id);
    const today = istNow().date;
    const until = new Date(`${today}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + 120);
    const end = until.toISOString().slice(0, 10);
    const changes = await prisma.scheduleChange.findMany({
      where: { institutionId: inst.id, date: { gte: today, lte: end } },
    });
    const body = icsFor({
      name: inst.name,
      slots: published.slots,
      room: req.nextUrl.searchParams.get("room") || "",
      section: req.nextUrl.searchParams.get("section") || "",
      changes,
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${inst.slug}.ics"`,
        ...(inst.isPublic ? { "Access-Control-Allow-Origin": "*" } : {}),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
