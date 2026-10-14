import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { audit } from "@/lib/audit";
import { linkFor, sendMail } from "@/lib/mail";
import { dummyVerify, hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { assertIpLimit, countAttempts, recordAttempt } from "@/lib/auth/rate-limit";
import {
  createSession,
  deleteSessionToken,
  deleteUserSessions,
  hashSecret,
  newRawToken,
} from "@/lib/auth/session";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import { isRole, RANK, type Role } from "@/lib/auth/roles";
import { InstitutionInput, LoginInput, Signup, zodFields } from "@/lib/schemas";
import { assertLastOwner } from "@/lib/timetable-repo";

const FIFTEEN = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const GENERIC_LOGIN = "Invalid email or password";

function pairKey(email: string, ip: string) {
  return `fail:${email}:${ip}`;
}

async function noteLoginFailure(email: string, ip: string, userId?: string) {
  await recordAttempt(`ip:${ip}`);
  await recordAttempt(pairKey(email, ip));
  const failures = await countAttempts(pairKey(email, ip), FIFTEEN);
  if (!userId) return failures;
  await prisma.user.update({
    where: { id: userId },
    data: { failedLogins: failures, lockedUntil: null },
  });
  if (failures >= 5) await audit("lockout", { userId, details: ip });
  return failures;
}

export async function signup(input: unknown, meta: { ip: string; userAgent?: string | null }) {
  const parsed = Signup.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Check the form", zodFields(parsed.error));
  await assertIpLimit(`signup:${meta.ip}`, 5, HOUR);
  await assertIpLimit(`signup-email:${parsed.data.email}`, 5, HOUR);
  await recordAttempt(`signup:${meta.ip}`);
  await recordAttempt(`signup-email:${parsed.data.email}`);
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const passwordHash = await hashPassword(parsed.data.password);
  if (existing) {
    return { created: false as const, message: "If that address can be registered, we sent a verification link." };
  }
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name || null,
      passwordHash,
    },
  });
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const link = linkFor(`/auth/verify?token=${token}`);
  try {
    await sendMail(user.email, "Verify your Hall Ledger email", `Open this link and confirm: ${link}`, link);
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw error;
  }
  const session = await createSession(user.id, meta);
  await audit("signup", { userId: user.id });
  return { created: true as const, session, message: "Account created. Check your email to verify it." };
}

export async function login(input: unknown, meta: { ip: string; userAgent?: string | null }) {
  const parsed = LoginInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, GENERIC_LOGIN);
  const ipCount = await countAttempts(`ip:${meta.ip}`, FIFTEEN);
  if (ipCount >= 20) throw new HttpError(429, "Too many attempts. Try again later.");
  const pairFailures = await countAttempts(pairKey(parsed.data.email, meta.ip), FIFTEEN);
  if (pairFailures >= 5) {
    await recordAttempt(`ip:${meta.ip}`);
    throw new HttpError(401, GENERIC_LOGIN);
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await dummyVerify(parsed.data.password);
  if (!user || !ok) {
    await noteLoginFailure(parsed.data.email, meta.ip, user?.id);
    throw new HttpError(401, GENERIC_LOGIN);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null },
  });
  const session = await createSession(user.id, meta);
  await audit("login", { userId: user.id });
  return { session, userId: user.id };
}

export async function logout(rawToken: string | undefined, userId?: string) {
  if (rawToken) await deleteSessionToken(rawToken);
  if (userId) await audit("logout", { userId });
}

export async function resendVerification(userId: string, ip: string) {
  await assertIpLimit(`verify:${ip}`, 5, HOUR);
  await recordAttempt(`verify:${ip}`);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.emailVerifiedAt) return;
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const link = linkFor(`/auth/verify?token=${token}`);
  await sendMail(user.email, "Verify your Hall Ledger email", `Open this link and confirm: ${link}`, link);
}

export async function verifyEmail(token: string) {
  const row = await consumeToken(token, "EMAIL_VERIFY");
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  await audit("verify", { userId: row.userId });
}

export async function requestPasswordReset(email: string, ip: string) {
  const normalized = email.toLowerCase().trim();
  await assertIpLimit(`reset:${ip}`, 5, HOUR);
  await assertIpLimit(`reset-email:${normalized}`, 5, HOUR);
  await recordAttempt(`reset:${ip}`);
  await recordAttempt(`reset-email:${normalized}`);
  const message = "If that email exists, we sent a link.";
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    await dummyVerify(email);
    return message;
  }
  const token = await issueToken(user.id, "PASSWORD_RESET");
  const link = linkFor(`/reset?token=${token}`);
  await sendMail(user.email, "Reset your Hall Ledger password", `Open this link and choose a new password: ${link}`, link);
  await audit("reset-request", { userId: user.id });
  return message;
}

export async function resetPassword(token: string, password: string) {
  const issue = passwordIssue(password);
  if (issue) throw new HttpError(400, issue);
  const row = await consumeToken(token, "PASSWORD_RESET");
  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash, failedLogins: 0, lockedUntil: null },
  });
  await deleteUserSessions(row.userId);
  await audit("reset", { userId: row.userId });
}

export async function changePassword(userId: string, current: string, next: string) {
  const issue = passwordIssue(next);
  if (issue) throw new HttpError(400, issue);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Sign in required");
  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) throw new HttpError(400, "Current password is wrong");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await deleteUserSessions(userId);
  await audit("password-change", { userId });
}

export async function deleteOwnAccount(userId: string) {
  const owned = await prisma.membership.findMany({ where: { userId, role: "OWNER" } });
  for (const membership of owned) {
    const owners = await prisma.membership.count({
      where: { institutionId: membership.institutionId, role: "OWNER" },
    });
    if (owners <= 1) {
      throw new HttpError(400, "Transfer ownership before deleting this account.");
    }
  }
  await prisma.user.delete({ where: { id: userId } });
  await audit("account-delete", { userId });
}

export async function createInstitution(userId: string, input: unknown) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Sign in required");
  if (!user.emailVerifiedAt) throw new HttpError(403, "Verify your email before creating an institution.");
  await assertIpLimit(`school:${userId}`, 5, HOUR);
  await recordAttempt(`school:${userId}`);
  const parsed = InstitutionInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Check the form", zodFields(parsed.error));
  const taken = await prisma.institution.findUnique({ where: { slug: parsed.data.slug } });
  if (taken) throw new HttpError(400, "That address is already in use", { slug: "Choose another address" });
  const inst = await prisma.institution.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      memberships: { create: { userId, role: "OWNER" } },
      timetables: { create: { name: "Main" } },
    },
  });
  await audit("institution-create", { userId, institutionId: inst.id, details: inst.slug });
  return inst;
}

export async function updateInstitution(opts: {
  userId: string;
  institutionId: string;
  name: string;
  slug: string;
  isPublic: boolean;
}) {
  const parsed = InstitutionInput.safeParse({ name: opts.name, slug: opts.slug });
  if (!parsed.success) throw new HttpError(400, "Check the form", zodFields(parsed.error));
  const clash = await prisma.institution.findFirst({
    where: { slug: parsed.data.slug, NOT: { id: opts.institutionId } },
  });
  if (clash) throw new HttpError(400, "That address is already in use");
  const inst = await prisma.institution.update({
    where: { id: opts.institutionId },
    data: { name: parsed.data.name, slug: parsed.data.slug, isPublic: opts.isPublic },
  });
  await audit("settings", { userId: opts.userId, institutionId: inst.id, details: inst.slug });
  return inst;
}

export async function inviteMember(opts: {
  institutionId: string;
  invitedById: string;
  email: string;
  role: string;
  slug: string;
}) {
  if (!isRole(opts.role) || opts.role === "OWNER") {
    throw new HttpError(400, "Choose viewer, editor, or admin.");
  }
  await assertIpLimit(`invite:${opts.invitedById}`, 20, HOUR);
  await recordAttempt(`invite:${opts.invitedById}`);
  const email = opts.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email.");
  const raw = newRawToken();
  await prisma.invite.create({
    data: {
      institutionId: opts.institutionId,
      email,
      role: opts.role,
      tokenHash: hashSecret(raw),
      invitedById: opts.invitedById,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  const link = linkFor(`/invite/${raw}`);
  await sendMail(email, "You are invited to Hall Ledger", `Open this link and confirm: ${link}`, link);
  await audit("invite", { userId: opts.invitedById, institutionId: opts.institutionId, details: opts.role });
}

export async function acceptInvite(raw: string, userId: string) {
  const tokenHash = hashSecret(raw);
  const invite = await prisma.invite.findUnique({ where: { tokenHash }, include: { institution: true } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new HttpError(400, "This invite is invalid or has expired.");
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Sign in required");
  if (user.email !== invite.email) {
    throw new HttpError(403, "This invite was sent to a different email.");
  }
  if (!isRole(invite.role)) throw new HttpError(400, "This invite is invalid or has expired.");
  const existing = await prisma.membership.findUnique({
    where: { institutionId_userId: { institutionId: invite.institutionId, userId } },
  });
  const current = existing && isRole(existing.role) ? existing.role : null;
  const nextRole = current && RANK[current] >= RANK[invite.role] ? current : invite.role;
  await assertLastOwner(invite.institutionId, userId, nextRole);
  const claimed = await prisma.invite.updateMany({
    where: { id: invite.id, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (claimed.count !== 1) throw new HttpError(400, "This invite is invalid or has expired.");
  await prisma.membership.upsert({
    where: { institutionId_userId: { institutionId: invite.institutionId, userId } },
    update: { role: nextRole },
    create: { institutionId: invite.institutionId, userId, role: nextRole },
  });
  await audit("invite-accept", { userId, institutionId: invite.institutionId, details: invite.role });
  return invite.institution.slug;
}

export async function setMemberRole(opts: {
  actorId: string;
  actorRole: Role;
  institutionId: string;
  userId: string;
  role: string;
}) {
  if (!isRole(opts.role)) throw new HttpError(400, "Unknown role");
  if (RANK[opts.role] > RANK[opts.actorRole]) throw new HttpError(403, "You cannot grant that role");
  const target = await prisma.membership.findUnique({
    where: { institutionId_userId: { institutionId: opts.institutionId, userId: opts.userId } },
  });
  if (!target || !isRole(target.role)) throw new HttpError(404, "Member not found");
  assertOutranks(opts.actorRole, target.role);
  await assertLastOwner(opts.institutionId, opts.userId, opts.role);
  await prisma.membership.update({
    where: { institutionId_userId: { institutionId: opts.institutionId, userId: opts.userId } },
    data: { role: opts.role },
  });
  await audit("role-change", { userId: opts.actorId, institutionId: opts.institutionId, details: opts.role });
}

function assertOutranks(actorRole: Role, targetRole: Role) {
  if (targetRole === "OWNER" && actorRole !== "OWNER") {
    throw new HttpError(403, "Only an owner can change another owner");
  }
  if (actorRole !== "OWNER" && RANK[actorRole] <= RANK[targetRole]) {
    throw new HttpError(403, "You cannot change that member");
  }
}

export async function removeMember(opts: {
  actorId: string;
  actorRole: Role;
  institutionId: string;
  userId: string;
}) {
  const target = await prisma.membership.findUnique({
    where: { institutionId_userId: { institutionId: opts.institutionId, userId: opts.userId } },
  });
  if (!target || !isRole(target.role)) throw new HttpError(404, "Member not found");
  assertOutranks(opts.actorRole, target.role);
  await assertLastOwner(opts.institutionId, opts.userId, null);
  await prisma.membership.delete({
    where: { institutionId_userId: { institutionId: opts.institutionId, userId: opts.userId } },
  });
  await audit("member-remove", { userId: opts.actorId, institutionId: opts.institutionId });
}

export async function listSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, ip: true, userAgent: true },
  });
}

export async function searchInstitutions(query: string) {
  const q = query.trim().slice(0, 80);
  return prisma.institution.findMany({
    where: {
      isPublic: true,
      ...(q
        ? { OR: [{ name: { contains: q } }, { slug: { contains: q.toLowerCase() } }] }
        : {}),
    },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
    take: 24,
  });
}
