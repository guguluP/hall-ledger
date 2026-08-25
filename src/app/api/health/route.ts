import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result: any = {
    ok: true,
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    databaseUrlPrefix: (process.env.DATABASE_URL || "").slice(0, 12),
    prisma: null as string | null,
    error: null as string | null,
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$connect();
    const count = await prisma.classroom.count().catch(() => -1);
    result.prisma = "connected";
    result.classroomCount = count;
    await prisma.$disconnect().catch(() => {});
  } catch (e: any) {
    result.ok = false;
    result.prisma = "failed";
    result.error = e?.message || String(e);
  }

  return NextResponse.json(result);
}
