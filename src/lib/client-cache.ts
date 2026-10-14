/** Labs-only preference. Published timetables are not cached in the browser. */

export const CLIENT_LABS_KEY = "hall-ledger-labs-only";

export function saveLabsOnly(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLIENT_LABS_KEY, value ? "1" : "0");
  } catch {
    // ignore quota
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
