import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { getCurrentUser } from "@/lib/auth/session";
import { isRole, RANK, RESERVED_SLUGS, type Role } from "@/lib/auth/roles";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Sign in required");
  return user;
}

export async function membershipFor(userId: string, institutionId: string) {
  return prisma.membership.findUnique({
    where: { institutionId_userId: { institutionId, userId } },
  });
}

export async function requireRoleForUser(userId: string, slug: string, min: Role) {
  const inst = await prisma.institution.findUnique({ where: { slug } });
  if (!inst) throw new HttpError(404, "Not found");
  const membership = await membershipFor(userId, inst.id);
  if (!membership || !isRole(membership.role) || RANK[membership.role] < RANK[min]) {
    throw new HttpError(403, "You do not have access to do that");
  }
  return { inst, role: membership.role };
}

export async function requireRole(slug: string, min: Role) {
  const user = await requireUser();
  const { inst, role } = await requireRoleForUser(user.id, slug, min);
  return { user, inst, role };
}

export async function visibleInstitution(slug: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || RESERVED_SLUGS.has(slug)) return null;
  const inst = await prisma.institution.findUnique({ where: { slug } });
  if (!inst) return null;
  if (inst.isPublic) return inst;
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const membership = await membershipFor(user.id, inst.id);
  if (!membership) return null;
  return inst;
}

export async function requireVisible(slug: string) {
  const inst = await visibleInstitution(slug);
  if (!inst) throw new HttpError(404, "Not found");
  return inst;
}
