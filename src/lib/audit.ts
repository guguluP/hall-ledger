import { prisma } from "@/lib/prisma";

export async function audit(
  action: string,
  opts: { userId?: string | null; institutionId?: string | null; details?: string | null } = {},
) {
  const details = opts.details?.slice(0, 300) || null;
  console.info(
    "[audit]",
    JSON.stringify({ action, userId: opts.userId || null, institutionId: opts.institutionId || null }),
  );
  await prisma.auditLog.create({
    data: {
      action,
      userId: opts.userId || null,
      institutionId: opts.institutionId || null,
      details,
    },
  }).catch((error) => {
    console.error("[audit] write failed", error);
  });
}
