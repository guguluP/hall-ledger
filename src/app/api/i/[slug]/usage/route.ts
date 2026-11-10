import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireRole } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";
import { usageCsv, weeklyUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const { inst } = await requireRole(slug, "VIEWER");
    const published = await getPublished(inst.id);
    const usage = weeklyUsage(published.rooms, published.slots, inst.dayStartMin, inst.dayEndMin, inst.sundayOpen);
    return new NextResponse(usageCsv(usage.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${inst.slug}-utilisation.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
