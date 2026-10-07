/** Shared size limits. Safe to import from client and server code. */

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_PUBLISH_BYTES = 10 * 1024 * 1024; // 10 MB

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Server-side: honours UPLOAD_MAX_BYTES, falls back to 5 MB. */
export function maxUploadBytes(env: Record<string, string | undefined> = process.env): number {
  return positiveInt(env.UPLOAD_MAX_BYTES, DEFAULT_MAX_UPLOAD_BYTES);
}

/** Server-side: honours PUBLISH_MAX_BYTES, falls back to 10 MB. */
export function maxPublishBytes(env: Record<string, string | undefined> = process.env): number {
  return positiveInt(env.PUBLISH_MAX_BYTES, DEFAULT_MAX_PUBLISH_BYTES);
}

/** True when the declared Content-Length already exceeds the cap. */
export function declaredTooLarge(req: Request, maxBytes: number): boolean {
  const raw = req.headers.get("content-length");
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
