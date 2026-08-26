import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = body?.parse;
    if (!parse) {
      return NextResponse.json({ error: "Missing parse payload" }, { status: 400 });
    }

    try {
      const { prisma } = await import("@/lib/prisma");
      const sections = parse.sections ?? [];
      const slots = parse.allSlots ?? [];
      const count = await prisma.classroom.count().catch(() => 0);
      return NextResponse.json({
        message: count
          ? `Publish received (${slots.length} slots).`
          : `Publish accepted (${slots.length} slots). Add DATABASE_URL on Vercel to persist.`,
        stats: {
          sections: sections.length,
          slots: slots.length,
          classrooms: count,
        },
      });
    } catch {
      return NextResponse.json({
        message: `Publish accepted (${(parse.allSlots ?? []).length} slots). Database not configured.`,
        stats: {
          sections: (parse.sections ?? []).length,
          slots: (parse.allSlots ?? []).length,
          classrooms: 0,
        },
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Publish failed" },
      { status: 500 },
    );
  }
}
