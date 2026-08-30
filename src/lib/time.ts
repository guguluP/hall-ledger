/** Time helpers. College day is ~9:30 AM–5:30 PM; afternoon hours 1–6 without AM/PM are PM. */

const PERIOD_MINUTES = 60;

export function parseTimeToMinutes(
  time: string,
  opts?: { assumeAfternoon?: boolean },
): number {
  const raw = String(time ?? "").trim();
  if (!raw) return -1;

  const meridian = raw.match(
    /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap])\.?\s*m\.?$/i,
  );
  if (meridian) {
    let h = parseInt(meridian[1], 10);
    const min = parseInt(meridian[2], 10);
    if (h > 12 || min > 59) return -1;
    const pm = meridian[3].toLowerCase() === "p";
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + min;
  }

  const hm = raw.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!hm) return -1;
  let h = parseInt(hm[1], 10);
  const min = parseInt(hm[2], 10);
  if (h > 24 || min > 59) return -1;
  if (h === 24) {
    if (min !== 0) return -1;
    return 0;
  }
  if (opts?.assumeAfternoon && h >= 1 && h <= 6) h += 12;
  return h * 60 + min;
}

export function toMinutes(time: string): number {
  return parseTimeToMinutes(time);
}

export function fromMinutes(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function padTime(time: string): string {
  const mins = parseTimeToMinutes(time);
  if (mins < 0) return String(time || "");
  return fromMinutes(mins);
}

export function labelTime(time: string | number): string {
  const mins = typeof time === "number" ? time : parseTimeToMinutes(String(time));
  if (mins < 0) return String(time ?? "");
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = ((h + 11) % 12) + 1;
  const ap = h >= 12 ? "PM" : "AM";
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Slot times from timetables: 1:00–6:59 with no meridian → PM. */
export function slotMinutes(time: string): number {
  return parseTimeToMinutes(time, { assumeAfternoon: true });
}

export function slotEndMinutes(startTime: string, endTime: string): number {
  const start = slotMinutes(startTime);
  if (start < 0) return -1;
  let end = parseTimeToMinutes(endTime);
  if (end < 0) end = parseTimeToMinutes(endTime, { assumeAfternoon: true });
  if (end < 0 || end <= start) {
    const pm = parseTimeToMinutes(endTime, { assumeAfternoon: true });
    if (pm > start) end = pm;
    else end = start + PERIOD_MINUTES;
  }
  return end;
}

export type TimeWindow = {
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  interpretedPm: boolean;
};

/**
 * Build a search window. If To is earlier than From (e.g. 9:30 → 5:30),
 * treat the end as PM so 5:30 means 5:30 PM, not 5:30 AM.
 */
export function normalizeWindow(start: string, end: string): TimeWindow | null {
  const startMin = parseTimeToMinutes(start);
  let endMin = parseTimeToMinutes(end);
  if (startMin < 0 || endMin < 0) return null;

  let interpretedPm = false;
  if (endMin <= startMin && endMin < 12 * 60) {
    endMin += 12 * 60;
    interpretedPm = true;
  }
  if (endMin <= startMin) return null;
  if (endMin - startMin > 12 * 60) return null;

  return {
    start: fromMinutes(startMin),
    end: fromMinutes(endMin),
    startMin,
    endMin,
    interpretedPm,
  };
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const s1 = slotMinutes(aStart);
  const e1 = slotEndMinutes(aStart, aEnd);
  const s2 = slotMinutes(bStart);
  const e2 = slotEndMinutes(bStart, bEnd);
  if ([s1, e1, s2, e2].some((n) => n < 0)) return false;
  return s1 < e2 && s2 < e1;
}

export function coversStart(slotStart: string, slotEnd: string, at: string): boolean {
  const s = slotMinutes(slotStart);
  const e = slotEndMinutes(slotStart, slotEnd);
  const t = parseTimeToMinutes(at);
  if ([s, e, t].some((n) => n < 0)) return false;
  return t >= s && t < e;
}
