/**
 * Tiny fixed-window rate limiter.
 *
 * Best-effort only: state lives in module memory, so on serverless hosts each
 * warm instance keeps its own counters. It blunts bursts and accidental loops;
 * it is not a substitute for edge/WAF rate limiting.
 */

type Bucket = { count: number; resetAt: number };
type GlobalRate = { __hallLedgerRate?: Map<string, Bucket> };

const g = globalThis as unknown as GlobalRate;

function store(): Map<string, Bucket> {
  if (!g.__hallLedgerRate) g.__hallLedgerRate = new Map();
  return g.__hallLedgerRate;
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const buckets = store();

  if (buckets.size > 2000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > opts.limit) return { ok: false, remaining: 0, retryAfterSec };
  return { ok: true, remaining: opts.limit - bucket.count, retryAfterSec };
}

export function resetRateLimits(): void {
  store().clear();
}

/** Best-effort client IP (Netlify, then standard proxy headers). */
export function clientIp(req: Request): string {
  const nf = req.headers.get("x-nf-client-connection-ip");
  if (nf) return nf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
