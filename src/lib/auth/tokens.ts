import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { hashSecret, newRawToken } from "@/lib/auth/session";

export type TokenType = "EMAIL_VERIFY" | "PASSWORD_RESET";

const HOURS: Record<TokenType, number> = {
  EMAIL_VERIFY: 24,
  PASSWORD_RESET: 1,
};

export function tokenLifetimeMs(type: TokenType): number {
  return HOURS[type] * 60 * 60 * 1000;
}

export async function issueToken(userId: string, type: TokenType) {
  const raw = newRawToken();
  await prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashSecret(raw),
      expiresAt: new Date(Date.now() + tokenLifetimeMs(type)),
    },
  });
  return raw;
}

export async function consumeToken(raw: string, type: TokenType) {
  const tokenHash = hashSecret(raw);
  const updated = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) {
    throw new HttpError(400, "This link is invalid or has expired.");
  }
  const row = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!row) throw new HttpError(400, "This link is invalid or has expired.");
  return row;
}
