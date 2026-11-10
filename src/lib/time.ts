/**
 * Time helpers.
 * A bare college clock uses one rule everywhere: 8–11 stay morning, 12 is noon,
 * and 1–7 are afternoon. Explicit AM/PM is kept. Search boxes send 24-hour
 * values and do not use this guess.
 */

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
  if (h === 24) return -1;
  if (opts?.assumeAfternoon && h >= 1 && h <= 7) h += 12;
  return h * 60 + min;
}

export type ClassRange = { startMin: number; endMin: number; assumedPm: boolean };

function meridianOf(value: string | undefined) {
  const text = (value || "").toLowerCase().replace(/\./g, "");
  if (text === "am" || text === "a") return "am";
  if (text === "pm" || text === "p") return "pm";
  return "";
}

function bareHour(hour: number, minute: number, meridian: string, afternoon: boolean) {
  if (hour > 24 || minute > 59) return -1;
  let h = hour;
  if (meridian === "pm" && h < 12) h += 12;
  if (meridian === "am" && h === 12) h = 0;
  if (!meridian && afternoon && h >= 1 && h <= 7) h += 12;
  if (h > 23) return -1;
  return h * 60 + minute;
}

/** One range parser for grid headers and Start/End columns. */
export function parseClassRange(cell: string): ClassRange | null {
  const match = String(cell ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})[.:](\d{2})\s*(A\.?M\.?|P\.?M\.?)?\s*(?:-|–|—|\bto\b)+\s*(\d{1,2})[.:](\d{2})\s*(A\.?M\.?|P\.?M\.?)?/i);
  if (!match) return null;
  const startMeridian = meridianOf(match[3]);
  const endMeridian = meridianOf(match[6]);
  const afternoon = !startMeridian && !endMeridian;
  const start = bareHour(parseInt(match[1], 10), parseInt(match[2], 10), startMeridian, afternoon);
  let end = bareHour(parseInt(match[4], 10), parseInt(match[5], 10), endMeridian, afternoon);
  if (start < 0 || end < 0) return null;
  let assumedPm = afternoon && (parseInt(match[1], 10) >= 1 && parseInt(match[1], 10) <= 7 || parseInt(match[4], 10) >= 1 && parseInt(match[4], 10) <= 7);
  if (end <= start && !endMeridian && end < 12 * 60) {
    const shifted = end + 12 * 60;
    if (shifted > start && shifted - start <= 6 * 60) {
      end = shifted;
      assumedPm = true;
    }
  }
  if (end <= start) return null;
  return { startMin: start, endMin: end, assumedPm };
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

/** Slot times from timetables. Uses the same 1–7 afternoon rule as parseClassRange. */
export function slotMinutes(time: string): number {
  return parseTimeToMinutes(time, { assumeAfternoon: true });
}

export function slotEndMinutes(startTime: string, endTime: string): number {
  const range = parseClassRange(`${startTime}-${endTime}`);
  if (range) return range.endMin;
  const start = slotMinutes(startTime);
  if (start < 0) return -1;
  return start + PERIOD_MINUTES;
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
