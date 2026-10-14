import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { login, requestPasswordReset, resetPassword, signup, verifyEmail } from "@/lib/auth/service";
import { requireRoleForUser, visibleInstitution } from "@/lib/auth/authz";
import { userFromSessionToken } from "@/lib/auth/session";
import { consumeToken } from "@/lib/auth/tokens";
import { createDraft, publishVersionFor } from "@/lib/timetable-repo";
import { removeMember, setMemberRole } from "@/lib/auth/service";
import { DEV_MAIL_LOG } from "@/lib/mail";

const meta = { ip: "203.0.113.10", userAgent: "vitest" };

async function resetDb() {
  await prisma.slot.deleteMany();
  await prisma.timetableVersion.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.sectionStrength.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.room.deleteMany();
  await prisma.institution.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  writeFileSync(DEV_MAIL_LOG, "");
}

function lastToken() {
  const text = readFileSync(DEV_MAIL_LOG, "utf8").trim().split("\n").pop() || "";
  const link = text.split("\t").pop() || "";
  const url = new URL(link);
  return url.searchParams.get("token") || url.pathname.split("/").pop() || "";
}

async function verifiedUser(email: string) {
  const created = await signup({ email, password: "correct-horse", name: "Ada" }, { ...meta, ip: `198.51.100.${email.length}` });
  expect(created.created).toBe(true);
  await verifyEmail(lastToken());
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return user;
}

describe("auth and tenancy", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("signs up, verifies, logs in, and locks on the sixth failure", async () => {
    const created = await signup({ email: "ada@school.test", password: "correct-horse", name: "Ada" }, meta);
    expect(created.created).toBe(true);
    if (!created.created) return;
    const sessionUser = await userFromSessionToken(created.session);
    expect(sessionUser?.email).toBe("ada@school.test");
    await verifyEmail(lastToken());
    await expect(consumeToken(lastToken(), "EMAIL_VERIFY")).rejects.toBeInstanceOf(HttpError);
    const logged = await login({ email: "ada@school.test", password: "correct-horse" }, meta);
    expect(await userFromSessionToken(logged.session)).toBeTruthy();
    for (let i = 0; i < 5; i++) {
      await expect(login({ email: "ada@school.test", password: "wrong-horse" }, { ...meta, ip: "203.0.113.20" })).rejects.toMatchObject({ status: 401 });
    }
    const locked = await prisma.user.findUniqueOrThrow({ where: { email: "ada@school.test" } });
    expect(locked.lockedUntil && locked.lockedUntil > new Date()).toBeTruthy();
    await expect(login({ email: "ada@school.test", password: "correct-horse" }, { ...meta, ip: "203.0.113.21" })).rejects.toMatchObject({ status: 401 });
  });

  it("resets the password and rejects a used or expired token", async () => {
    const user = await verifiedUser("bea@school.test");
    const old = await login({ email: user.email, password: "correct-horse" }, meta);
    await requestPasswordReset(user.email, "203.0.113.30");
    const token = lastToken();
    await resetPassword(token, "another-horse");
    expect(await userFromSessionToken(old.session)).toBeNull();
    await expect(resetPassword(token, "third-horse!!")).rejects.toBeInstanceOf(HttpError);
    await prisma.authToken.updateMany({ data: { usedAt: null, expiresAt: new Date(Date.now() - 1000) } });
    await expect(consumeToken(token, "PASSWORD_RESET")).rejects.toBeInstanceOf(HttpError);
  });

  it("isolates drafts, publishing, private schools, and the last owner", async () => {
    const owner = await verifiedUser("owner@school.test");
    const editor = await verifiedUser("editor@school.test");
    const viewer = await verifiedUser("viewer@school.test");
    const school = await prisma.institution.create({ data: { slug: "north", name: "North", isPublic: false } });
    const other = await prisma.institution.create({ data: { slug: "south", name: "South", isPublic: true } });
    await prisma.membership.createMany({
      data: [
        { institutionId: school.id, userId: owner.id, role: "OWNER" },
        { institutionId: school.id, userId: editor.id, role: "EDITOR" },
        { institutionId: school.id, userId: viewer.id, role: "VIEWER" },
        { institutionId: other.id, userId: editor.id, role: "EDITOR" },
      ],
    });
    await prisma.room.create({ data: { institutionId: school.id, name: "316", capacity: 60 } });
    expect(await visibleInstitution("north")).toBeNull();
    await expect(requireRoleForUser(viewer.id, "north", "EDITOR")).rejects.toMatchObject({ status: 403 });

    const csv = readFileSync(path.join(process.cwd(), "public/samples/tabular-template.csv"));
    const draft = await createDraft({ institutionId: school.id, userId: editor.id, fileName: "tabular-template.csv", bytes: new Uint8Array(csv) });
    expect(draft.summary.totalSlots).toBeGreaterThan(0);
    await expect(
      publishVersionFor({ institutionId: other.id, userId: editor.id, versionId: draft.versionId, emailVerifiedAt: editor.emailVerifiedAt }),
    ).rejects.toMatchObject({ status: 404 });
    await publishVersionFor({
      institutionId: school.id,
      userId: editor.id,
      versionId: draft.versionId,
      emailVerifiedAt: editor.emailVerifiedAt,
    });
    const published = await prisma.timetableVersion.count({ where: { status: "PUBLISHED", timetable: { institutionId: school.id } } });
    expect(published).toBe(1);

    const second = await createDraft({ institutionId: school.id, userId: editor.id, fileName: "tabular-template.csv", bytes: new Uint8Array(csv) });
    await publishVersionFor({ institutionId: school.id, userId: editor.id, versionId: second.versionId, emailVerifiedAt: editor.emailVerifiedAt });
    const live = await prisma.timetableVersion.findMany({ where: { timetable: { institutionId: school.id } } });
    expect(live.filter((version) => version.status === "PUBLISHED")).toHaveLength(1);
    expect(live.find((version) => version.id === draft.versionId)?.status).toBe("ARCHIVED");
    await publishVersionFor({ institutionId: school.id, userId: editor.id, versionId: draft.versionId, emailVerifiedAt: editor.emailVerifiedAt });
    const rolled = await prisma.timetable.findFirstOrThrow({ where: { institutionId: school.id } });
    expect(rolled.activeVersionId).toBe(draft.versionId);

    await expect(setMemberRole({ actorId: owner.id, actorRole: "OWNER", institutionId: school.id, userId: owner.id, role: "ADMIN" })).rejects.toMatchObject({ status: 400 });
    await expect(removeMember({ actorId: owner.id, institutionId: school.id, userId: owner.id })).rejects.toMatchObject({ status: 400 });
  });
});
