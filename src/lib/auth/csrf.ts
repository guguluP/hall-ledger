import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { HttpError } from "@/lib/http-error";
import { CSRF_COOKIE } from "@/lib/auth/constants";
import { tokensEqual } from "@/lib/auth/session";

export { CSRF_COOKIE };

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function readCookie(header: string | null, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function assertOrigin(req: Request) {
  const value = req.headers.get("origin") || req.headers.get("referer");
  if (!value) throw new HttpError(403, "Request blocked");
  let host = "";
  try {
    host = new URL(value).host;
  } catch {
    throw new HttpError(403, "Request blocked");
  }
  if (host !== new URL(appUrl()).host) throw new HttpError(403, "Request blocked");
}

export function assertCsrf(req: Request) {
  const header = req.headers.get("x-csrf-token") || "";
  const cookie = readCookie(req.headers.get("cookie"), CSRF_COOKIE);
  if (!header || !cookie || !tokensEqual(header, cookie)) {
    throw new HttpError(403, "Request blocked");
  }
}

export function assertMutation(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  assertOrigin(req);
  assertCsrf(req);
}

export async function ensureCsrfToken() {
  const jar = await cookies();
  let token = jar.get(CSRF_COOKIE)?.value;
  if (!token) {
    token = randomBytes(32).toString("base64url");
    jar.set(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return token;
}
