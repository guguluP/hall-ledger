/** Browser cache so Grid/Find/Home still work when Vercel instances don't share /tmp */

export const CLIENT_PUBLISH_KEY = "hall-ledger-published-v1";
export const CLIENT_LABS_KEY = "hall-ledger-labs-only";

export function saveClientPublished(payload: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_PUBLISH_KEY, JSON.stringify(payload));
  } catch {
    // quota
  }
}

export function loadClientPublished<T = any>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CLIENT_PUBLISH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.slots?.length) return data as T;
    return null;
  } catch {
    return null;
  }
}

export function resolvePublished<T extends { slots?: unknown[]; source?: string }>(
  api: T | null | undefined,
): T | null {
  if (api?.slots && Array.isArray(api.slots) && api.slots.length > 0) return api;
  return loadClientPublished<T>();
}

export function saveLabsOnly(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_LABS_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export function loadLabsOnly(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLIENT_LABS_KEY) === "1";
  } catch {
    return false;
  }
}
