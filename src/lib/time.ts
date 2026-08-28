export function toMinutes(time: string): number {
  const m = String(time || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function padTime(time: string): string {
  const m = String(time || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(time || "");
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function labelTime(time: string): string {
  const m = padTime(time).match(/^(\d{2}):(\d{2})$/);
  if (!m) return time;
  const h = parseInt(m[1], 10);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${m[2]}`;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const s1 = toMinutes(aStart);
  const e1 = toMinutes(aEnd);
  const s2 = toMinutes(bStart);
  const e2 = toMinutes(bEnd);
  if ([s1, e1, s2, e2].some((n) => n < 0)) return false;
  return s1 < e2 && s2 < e1;
}

export function coversStart(slotStart: string, slotEnd: string, at: string): boolean {
  const s = toMinutes(slotStart);
  const e = toMinutes(slotEnd);
  const t = toMinutes(at);
  if ([s, e, t].some((n) => n < 0)) return false;
  if (e <= s) return t === s;
  return t >= s && t < e;
}
