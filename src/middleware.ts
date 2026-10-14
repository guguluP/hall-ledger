import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { RESERVED_SLUGS } from "@/lib/auth/roles";

function newCsrf() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function middleware(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && parts[1] === "manage" && !RESERVED_SLUGS.has(parts[0])) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  const res = NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value && !req.cookies.get(CSRF_COOKIE)?.value) {
    res.cookies.set(CSRF_COOKIE, newCsrf(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|samples|.*\\..*).*)"],
};
