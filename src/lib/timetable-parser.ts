/**
 * Multi-sheet 1st-year timetable parser (SEC_A..SEC_P workbooks)
 */
import * as XLSX from "xlsx";

export type SlotType =
  | "PP" | "PR" | "TUT" | "LAB" | "SKILL" | "OTHER"
  | "LUNCH" | "MENTORING" | "INTERACTION" | "CSR";

export type ParsedSlot = {
  section: string;
  room: string | null;
  day: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectRaw: string;
  subject: string;
  type: SlotType;
  roomOverride: string | null;
  isCombined: boolean;
  groups?: string[];
};

export type ParsedSection = {
  sheetName: string;
  sectionName: string;
  defaultRoom: string | null;
  slots: ParsedSlot[];
  courses: { code: string; title: string; faculty: string; credits?: string }[];
};

export type ParseResult = {
  sections: ParsedSection[];
  allSlots: ParsedSlot[];
  hardConflicts: {
    type: "ROOM_OVERLAP";
    day: string;
    time: string;
    room: string;
    sections: string[];
    subjects: string[];
  }[];
  summary: {
    totalSections: number;
    totalSlots: number;
    totalConflicts: number;
    unassigned: number;
    combinedLabs: number;
  };
};

const DAY_MAP: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
};

const SKIP = /^(lunch|csr(\s+activity)?|mentoring|hod\s+interaction|dean\s+interaction|-)?$/i;

export function isValidRoom(r: string | null | undefined): r is string {
  if (!r) return false;
  const t = r.trim().toUpperCase();
  if (!t || t === "-") return false;
  if (/^ME-\d{1,3}$/.test(t)) return true;
  if (!/^\d{2,4}$/.test(t)) return false;
  if (t.startsWith("0")) return false;
  const n = parseInt(t, 10);
  if (n >= 101 && n <= 104) return false;
  return true;
}

function toCanonicalRoom(raw: string): string | null {
  let t = raw.trim().toUpperCase().replace(/\s+/g, "");
  t = t.replace(/O(\d)/g, "0$1");
  if (!t) return null;
  if (/^ME\d+$/.test(t)) t = "ME-" + t.slice(2);
  if (/^ME-\d+$/.test(t)) {
    const n = t.slice(3);
    return n.length === 1 ? `ME-0${n}` : `ME-${n}`;
  }
  if (/^\d{2,4}$/.test(t)) {
    if (t.startsWith("0")) return `ME-${t.slice(1).padStart(2, "0")}`;
    const n = parseInt(t, 10);
    if (n >= 101 && n <= 104) return `ME-${n}`;
    return t;
  }
  return isValidRoom(t) ? t : null;
}

function extractRoom(src: string, fallback: string | null): string | null {
  if (!src) return fallback;
  const me = src.match(/\bME[-\s]*(\d{1,3})\b/i);
  if (me) return toCanonicalRoom("ME-" + me[1]);
  const roomNo = src.match(/Room\s*No\.?\s*[:-]*\s*(?:ME[-\s]*)?(\d{1,4}|O\d)\b/i);
  if (roomNo) return toCanonicalRoom(roomNo[1]);
  const rn = src.match(/R\.?\s*N(?:o)?\.?\s*[:-]*\s*(?:ME[-\s]*)?([O0-9]{1,4})\b/i);
  if (rn) return toCanonicalRoom(rn[1]);
  const lab = src.match(/\bLab[-\s]+(?:PR[-\s]+)?(\d{2,4})\b/i);
  if (lab) return toCanonicalRoom(lab[1]);
  const a = src.match(/-(\d{2,4})-(?:PP|PR|TUT)\b/i);
  if (a) return toCanonicalRoom(a[1]);
  const b = src.match(/-(?:PP|PR|TUT)-(\d{2,4})\b/i);
  if (b) return toCanonicalRoom(b[1]);
  return fallback;
}

function detectType(raw: string): SlotType {
  const u = raw.toUpperCase();
  if (/\bLUNCH\b/.test(u)) return "LUNCH";
  if (/\bCSR\b/.test(u)) return "CSR";
  if (/\bMENTOR/.test(u)) return "MENTORING";
  if (/\b(HOD|DEAN)\s*INTERACTION\b/.test(u)) return "INTERACTION";
  if (/\bSKILL\b/.test(u)) return "SKILL";
  if (/\bTUT\b/.test(u)) return "TUT";
  if (/\bPR\b/.test(u) || /\bLAB\b/.test(u)) return "PR";
  if (/\bPP\b/.test(u)) return "PP";
  return "OTHER";
}

function cleanSubject(raw: string): string {
  return raw
    .replace(/\s*-\s*(PP|PR|TUT|LAB)\b/gi, "")
    .replace(/\b(PP|PR|TUT|LAB)\b/gi, "")
    .replace(/R\.?\s*N(?:o)?\.?\s*[:-]*\s*(?:ME[-\s]*)?[O0-9]{1,4}/gi, "")
    .replace(/Room\s*No\.?\s*[:-]*\s*(?:ME[-\s]*)?\d{1,4}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sectionFrom(sheetName: string, cell: string): string {
  const m = cell.match(/SECTION[- ]?([A-Z0-9]+)/i);
  if (m) return "SECTION-" + m[1].toUpperCase();
  const m2 = sheetName.match(/SEC[_-]?([A-Z0-9]+)/i);
  if (m2) return "SECTION-" + m2[1].toUpperCase();
  return sheetName;
}

function defaultRoomFromLabel(label: string): string | null {
  const m = label.match(/Room\s*No\.?\s*[:-]*\s*(?:ME[-\s]*)?(\d{1,4}|O\d)/i);
  if (m) return toCanonicalRoom(m[1]);
  const me = label.match(/\bME[-\s]*(\d{1,3})\b/i);
  if (me) return toCanonicalRoom("ME-" + me[1]);
  return null;
}

function parseSheet(sheetName: string, sheet: XLSX.WorkSheet): ParsedSection | null {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];
  if (!rows.length) return null;

  let headerIdx = -1;
  let timeCols: { col: number; start: string; end: string }[] = [];

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].map((c: any) => String(c || ""));
    const found: { col: number; start: string; end: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c].replace(/\s+/g, " ").trim();
      const m = cell.match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)?\s*[-–to]+\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i);
      if (!m) continue;
      let h1 = parseInt(m[1], 10);
      let h2 = parseInt(m[4], 10);
      const ap1 = (m[3] || "").toUpperCase();
      const ap2 = (m[6] || "").toUpperCase();
      if (ap1 === "PM" && h1 < 12) h1 += 12;
      if (ap1 === "AM" && h1 === 12) h1 = 0;
      if (ap2 === "PM" && h2 < 12) h2 += 12;
      if (ap2 === "AM" && h2 === 12) h2 = 0;
      if (!ap1 && !ap2 && h1 <= 5) h1 += 12;
      if (!ap1 && !ap2 && h2 <= 5) h2 += 12;
      found.push({
        col: c,
        start: `${String(h1).padStart(2, "0")}:${m[2]}`,
        end: `${String(h2).padStart(2, "0")}:${m[5]}`,
      });
    }
    if (found.length >= 4) {
      headerIdx = i;
      timeCols = found;
      break;
    }
  }

  if (headerIdx < 0) return null;

  let sectionName = sectionFrom(sheetName, "");
  let defaultRoom: string | null = null;
  const slots: ParsedSlot[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((c: any) => String(c || "").trim());
    if (!row.some(Boolean)) continue;
    if (/^[A-Z]{2,5}\s*\d{3,4}/i.test(row[0] || "")) break;

    const dayCell = (row[0] || "").toLowerCase().replace(/\s+/g, "");
    const dayKey = Object.keys(DAY_MAP).find((d) => dayCell.startsWith(d.slice(0, 3)));
    const dayOfWeek = dayKey ? DAY_MAP[dayKey] : undefined;
    if (dayOfWeek == null) {
      const label = row.find((c) => /SECTION/i.test(c)) || "";
      if (label) {
        sectionName = sectionFrom(sheetName, label);
        defaultRoom = defaultRoomFromLabel(label) || defaultRoom;
      }
      continue;
    }

    const labelCol = row[1] || "";
    if (/SECTION/i.test(labelCol)) {
      sectionName = sectionFrom(sheetName, labelCol);
      defaultRoom = defaultRoomFromLabel(labelCol) || defaultRoom;
    }

    for (const tc of timeCols) {
      const raw = (row[tc.col] || "").trim();
      if (!raw || SKIP.test(raw)) continue;
      const type = detectType(raw);
      if (type === "LUNCH" || type === "CSR") continue;
      const room = extractRoom(raw, defaultRoom);
      slots.push({
        section: sectionName,
        room,
        day: dayKey ? dayKey.charAt(0).toUpperCase() + dayKey.slice(1) : String(dayOfWeek),
        dayOfWeek,
        startTime: tc.start,
        endTime: tc.end,
        subjectRaw: raw,
        subject: cleanSubject(raw) || raw,
        type,
        roomOverride: room && room !== defaultRoom ? room : null,
        isCombined: /Lab/i.test(raw) && /&/.test(raw) && !/Differential\s+Equation\s*&/i.test(raw),
      });
    }
  }

  return { sheetName, sectionName, defaultRoom, slots, courses: [] };
}

export function parseTimetableWorkbook(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sections: ParsedSection[] = [];
  const allSlots: ParsedSlot[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    try {
      const parsed = parseSheet(name, sheet);
      if (parsed && (parsed.slots.length > 0 || /SEC/i.test(name))) {
        sections.push(parsed);
        allSlots.push(...parsed.slots);
      }
    } catch (e) {
      console.warn("[parser] sheet failed", name, e);
    }
  }

  return {
    sections,
    allSlots,
    hardConflicts: [],
    summary: {
      totalSections: sections.length,
      totalSlots: allSlots.length,
      totalConflicts: 0,
      unassigned: allSlots.filter((s) => !isValidRoom(s.room)).length,
      combinedLabs: allSlots.filter((s) => s.isCombined).length,
    },
  };
}
