import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function recordAttempt(key: string) {
  await prisma.loginAttempt.create({ data: { key } });
  await prisma.loginAttempt.deleteMany({
    where: { at: { lt: new Date(Date.now() - DAY_MS) } },
  });
}

export async function countAttempts(key: string, windowMs: number) {
  return prisma.loginAttempt.count({
    where: { key, at: { gte: new Date(Date.now() - windowMs) } },
  });
}

export async function assertIpLimit(key: string, limit: number, windowMs: number) {
  const count = await countAttempts(key, windowMs);
  if (count >= limit) {
    throw new HttpError(429, "Too many attempts. Try again later.");
  }
}
