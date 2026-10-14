import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_MS = 60 * 60 * 1000;

export function hashSecret(value: string): string {
  const hash = createHash("sha256");
  if (process.env.SESSION_SECRET) hash.update(process.env.SESSION_SECRET);
  hash.update(value);
  return hash.digest("hex");
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function newRawToken(): string {
  return randomBytes(32).toString("base64url");
}

const cookieBase = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function setSessionCookie(raw: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, { ...cookieBase, maxAge: 30 * 24 * 60 * 60 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const raw = newRawToken();
  const now = new Date();
  await prisma.session.create({
    data: {
      id: hashSecret(raw),
      userId,
      expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
      lastSeenAt: now,
      ip: meta.ip?.slice(0, 64) || null,
      userAgent: meta.userAgent?.slice(0, 200) || null,
    },
  });
  return raw;
}

export async function deleteSessionToken(raw: string) {
  await prisma.session.deleteMany({ where: { id: hashSecret(raw) } });
}

export async function deleteUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function userFromSessionToken(raw: string) {
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { id: hashSecret(raw) },
    include: { user: true },
  });
  if (!session) return null;
  const idleCutoff = session.lastSeenAt.getTime() + IDLE_MS;
  if (session.expiresAt.getTime() <= now.getTime() || idleCutoff <= now.getTime()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= REFRESH_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
  }
  return session.user;
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return userFromSessionToken(raw);
});

export async function requestMeta() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return { ip, userAgent: h.get("user-agent") };
}
