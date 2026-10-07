/**
 * Error text that is safe to return to a browser.
 * Raw exception messages can expose paths, library internals or query text,
 * so production responses use the fallback instead.
 */
export function publicError(
  e: unknown,
  fallback: string,
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.NODE_ENV !== "production" && e instanceof Error && e.message) return e.message;
  return fallback;
}
