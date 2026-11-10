import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { requireVisible } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const inst = await requireVisible(slug);
    const published = await getPublished(inst.id);
    const response = NextResponse.json(published);
    if (inst.isPublic) response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } catch (error) {
    return apiError(error);
  }
}
