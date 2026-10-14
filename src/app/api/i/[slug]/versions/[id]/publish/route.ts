import { NextResponse } from "next/server";
import { apiError, assertBodyLimit, assertJsonContent } from "@/lib/api-error";
import { requireRole } from "@/lib/auth/authz";
import { assertMutation } from "@/lib/auth/csrf";
import { publishVersionFor } from "@/lib/timetable-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }) {
  try {
    assertMutation(req);
    assertJsonContent(req);
    assertBodyLimit(req);
    const { slug, id } = await ctx.params;
    const { user, inst } = await requireRole(slug, "EDITOR");
    await publishVersionFor({
      institutionId: inst.id,
      userId: user.id,
      versionId: id,
      emailVerifiedAt: user.emailVerifiedAt,
    });
    return NextResponse.json({ ok: true, versionId: id });
  } catch (error) {
    return apiError(error);
  }
}
