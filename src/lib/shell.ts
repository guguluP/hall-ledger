import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import type { ShellInstitution, ShellUser } from "@/components/app-shell";

export async function shellData() {
  const current = await getCurrentUser();
  const user: ShellUser = current
    ? { email: current.email, name: current.name, verified: Boolean(current.emailVerifiedAt) }
    : null;
  const memberships = current
    ? await prisma.membership.findMany({
        where: { userId: current.id },
        include: { institution: { select: { slug: true, name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const institutions: ShellInstitution[] = memberships.map((membership) => ({
    slug: membership.institution.slug,
    name: membership.institution.name,
    role: membership.role,
  }));
  return { user, institutions, current };
}
