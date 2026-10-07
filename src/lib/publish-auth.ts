import { createHash, timingSafeEqual } from "crypto";
import { clientIp } from "./rate-limit";

export type PublishAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function extractSecret(req: Request): string {
  const header = req.headers.get("x-publish-secret");
  if (header) return header.trim();
  const auth = req.headers.get("authorization");
  return auth ? auth.replace(/^Bearer\s+/i, "").trim() : "";
}

/**
 * Gate for write endpoints.
 * - PUBLISH_SECRET set: caller must send it (x-publish-secret or Bearer).
 * - PUBLISH_SECRET unset in production: fail closed (503), never open.
 * - PUBLISH_SECRET unset in dev/test: allowed, so local work stays frictionless.
 */
export function checkPublishAuth(
  req: Request,
  env: Record<string, string | undefined> = process.env,
): PublishAuthResult {
  const expected = env.PUBLISH_SECRET?.trim();

  if (!expected) {
    if (env.NODE_ENV === "production") {
      console.warn("[publish] refused: PUBLISH_SECRET is not configured");
      return {
        ok: false,
        status: 503,
        error: "Publishing is disabled: PUBLISH_SECRET is not configured on this deployment.",
      };
    }
    return { ok: true };
  }

  const provided = extractSecret(req);
  if (!provided || !safeEqual(provided, expected)) {
    // Never log the submitted value, only that an attempt failed and from where.
    console.warn(`[publish] unauthorized attempt from ${clientIp(req)}`);
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
