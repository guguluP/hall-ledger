import { CsvError, parseCsv } from "@/lib/parse/csv";
import { parseTimeToMinutes } from "@/lib/time";

export type SlotIn = {
  section: string;
  subject: string | null;
  room: string | null;
  type: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
};

export type HardConflict = {
  type: "ROOM_OVERLAP";
  day: string;
  time: string;
  room: string;
  sections: string[];
  subjects: string[];
};

export type TimetableParse = {
  slots: SlotIn[];
  warnings: string[];
  hardConflicts: HardConflict[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
};

const HEADER_ALIAS: Record<string, string> = {
  section: "section",
  sec: "section",
  class: "section",
  batch: "section",
  day: "day",
  dow: "day",
  weekday: "day",
  start: "start",
  from: "start",
  starttime: "start",
  end: "end",
  to: "end",
  endtime: "end",
  time: "time",
  timeslot: "time",
  period: "time",
  subject: "subject",
  course: "subject",
  paper: "subject",
  room: "room",
  hall: "room",
  classroom: "room",
  venue: "room",
  type: "type",
  kind: "type",
};

function keyOf(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function detectType(raw: string): string {
  const upper = raw.toUpperCase();
  if (/\bLUNCH\b/.test(upper)) return "LUNCH";
  if (/\bCSR\b/.test(upper)) return "CSR";
  if (/\bMENTOR/.test(upper)) return "MENTORING";
  if (/\b(HOD|DEAN)\b/.test(upper)) return "INTERACTION";
  if (/\bSKILL\b/.test(upper)) return "SKILL";
  if (/\bTUT\b/.test(upper)) return "TUT";
  if (/\bPR\b/.test(upper) || /\bLAB\b/.test(upper)) return "PR";
  if (/\bPP\b/.test(upper)) return "PP";
  return "CLASS";
}

function dayFrom(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/^[0-6]$/.test(text)) return Number(text);
  const hit = Object.keys(DAY_MAP).find((day) => text === day || text.startsWith(day));
  return hit ? DAY_MAP[hit] : null;
}

function clock(value: string, afternoon: boolean) {
  return parseTimeToMinutes(value, { assumeAfternoon: afternoon });
}

function rangeFrom(cell: string): { startMin: number; endMin: number } | null {
  const match = cell
    .replace(/\s+/g, " ")
    .trim()
    .match(/(\d{1,2})[.:](\d{2})\s*(AM|PM)?\s*[-–to]+\s*(\d{1,2})[.:](\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let startHour = parseInt(match[1], 10);
  let endHour = parseInt(match[4], 10);
  const startMin = parseInt(match[2], 10);
  const endMin = parseInt(match[5], 10);
  const startMeridian = (match[3] || "").toUpperCase();
  const endMeridian = (match[6] || "").toUpperCase();
  if (startMeridian === "PM" && startHour < 12) startHour += 12;
  if (startMeridian === "AM" && startHour === 12) startHour = 0;
  if (endMeridian === "PM" && endHour < 12) endHour += 12;
  if (endMeridian === "AM" && endHour === 12) endHour = 0;
  if (!startMeridian && !endMeridian && startHour <= 5) startHour += 12;
  if (!startMeridian && !endMeridian && endHour <= 5) endHour += 12;
  if (startHour > 23 || endHour > 23) return null;
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  if (end <= start) return null;
  return { startMin: start, endMin: end };
}

function sectionFrom(raw: string, fallback: string) {
  const text = raw.trim();
  const match = text.match(/SEC(?:TION)?[-_ ]?([A-Z0-9]+)/i);
  if (match) return `SECTION-${match[1].toUpperCase()}`.slice(0, 40);
  if (/^[A-Za-z]$/.test(text)) return `SECTION-${text.toUpperCase()}`;
  const cleaned = text.replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 40);
}

function sectionHintFromFile(fileName?: string) {
  if (!fileName) return "SECTION";
  const base = fileName.replace(/\.[^.]+$/, "");
  return sectionFrom(base, "SECTION");
}

function explicitRoom(src: string): string | null {
  if (!src) return null;
  const me = src.match(/\bME[-\s]*(\d{1,3})\b/i);
  if (me) {
    const n = me[1];
    return n.length === 1 ? `ME-0${n}` : `ME-${n}`;
  }
  const roomNo = src.match(/Room\s*No\.?\s*[:-]*\s*(\d{1,4})\b/i);
  if (roomNo) return String(parseInt(roomNo[1], 10));
  const rn = src.match(/R\.?\s*N(?:o)?\.?\s*[:-]*\s*([A-Za-z0-9-]{1,8})/i);
  if (rn) return rn[1].replace(/\s+/g, "").toUpperCase();
  const lab = src.match(/\bLab[-\s]+(?:PR[-\s]+)?(\d{2,4})\b/i);
  if (lab) return lab[1];
  const inline = src.match(/-(\d{2,4})-(?:PP|PR|TUT)\b/i) || src.match(/-(?:PP|PR|TUT)-(\d{2,4})\b/i);
  if (inline) return inline[1];
  return null;
}

function cleanSubject(raw: string) {
  return raw
    .replace(/\s*-\s*(PP|PR|TUT|LAB)\b/gi, "")
    .replace(/\b(PP|PR|TUT)\b/gi, "")
    .replace(/R\.?\s*N(?:o)?\.?\s*[:-]*\s*[A-Za-z0-9-]{1,8}/gi, "")
    .replace(/Room\s*No\.?\s*[:-]*\s*\d{1,4}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

const SKIP = /^(lunch|csr(\s+activity)?|mentoring|hod\s+interaction|dean\s+interaction|-)?$/i;

function matchKnown(raw: string | null, knownRooms: string[]): { room: string | null; warning?: string } {
  if (!raw) return { room: null };
  const norm = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
  const hit = knownRooms.find((room) => norm(room) === norm(raw));
  if (hit) return { room: hit };
  if (!/^[A-Za-z0-9 -]+$/.test(raw) || raw.length > 20) {
    return { room: null, warning: `Ignored room "${raw.slice(0, 40)}" because it is not a room name.` };
  }
  return { room: raw, warning: `Unknown room "${raw}" is not in this institution's room list.` };
}

function headerIndex(row: string[]) {
  const map: Record<string, number> = {};
  row.forEach((cell, index) => {
    const alias = HEADER_ALIAS[keyOf(cell)];
    if (alias && map[alias] == null) map[alias] = index;
  });
  const tabular = map.day != null && (map.subject != null || map.room != null) && (map.time != null || (map.start != null && map.end != null));
  return tabular ? map : null;
}

function parseTabular(rows: string[][], map: Record<string, number>, knownRooms: string[], fileName?: string): TimetableParse {
  const slots: SlotIn[] = [];
  const warnings: string[] = [];
  const fallback = sectionHintFromFile(fileName);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((cell) => cell.trim())) continue;
    const day = dayFrom(row[map.day] || "");
    if (day == null) {
      warnings.push(`Row ${i + 1} has an unrecognized day.`);
      continue;
    }
    let startMin = -1;
    let endMin = -1;
    if (map.time != null) {
      const range = rangeFrom(row[map.time] || "");
      if (!range) {
        warnings.push(`Row ${i + 1} has an unrecognized time.`);
        continue;
      }
      startMin = range.startMin;
      endMin = range.endMin;
    } else {
      startMin = clock(row[map.start] || "", true);
      endMin = clock(row[map.end] || "", true);
      if (startMin < 0 || endMin < 0 || endMin <= startMin) {
        warnings.push(`Row ${i + 1}: end must be after start.`);
        continue;
      }
    }
    const section = sectionFrom(map.section != null ? row[map.section] || "" : "", fallback);
    if (!section || section === "SECTION") {
      warnings.push(`Row ${i + 1} is missing a section.`);
      continue;
    }
    const subjectRaw = map.subject != null ? (row[map.subject] || "").trim() : "";
    const roomRaw = map.room != null ? (row[map.room] || "").trim() : "";
    const matched = matchKnown(roomRaw || null, knownRooms);
    if (matched.warning) warnings.push(`Row ${i + 1}: ${matched.warning}`);
    const typeRaw = map.type != null ? (row[map.type] || "").trim() : detectType(subjectRaw);
    slots.push({
      section,
      subject: subjectRaw ? cleanSubject(subjectRaw) || subjectRaw.slice(0, 120) : null,
      room: matched.room,
      type: (typeRaw || "CLASS").slice(0, 20),
      dayOfWeek: day,
      startMin,
      endMin,
    });
  }
  return finish(slots, warnings);
}

function parseGrid(rows: string[][], knownRooms: string[], fileName?: string): TimetableParse | null {
  let headerIdx = -1;
  let timeCols: { col: number; startMin: number; endMin: number }[] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const found: { col: number; startMin: number; endMin: number }[] = [];
    rows[i].forEach((cell, col) => {
      const range = rangeFrom(cell);
      if (range) found.push({ col, ...range });
    });
    if (found.length >= 4) {
      headerIdx = i;
      timeCols = found;
      break;
    }
  }
  if (headerIdx < 0) return null;

  const slots: SlotIn[] = [];
  const warnings: string[] = [];
  let sectionName = sectionHintFromFile(fileName);
  let defaultRoom: string | null = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i].map((cell) => cell.trim());
    if (!row.some(Boolean)) continue;
    const day = dayFrom(row[0] || "");
    if (day == null) {
      const label = row.find((cell) => /SECTION/i.test(cell)) || "";
      if (label) {
        sectionName = sectionFrom(label, sectionName);
        defaultRoom = explicitRoom(label) || defaultRoom;
      }
      continue;
    }
    const labelCol = row[1] || "";
    if (/SECTION/i.test(labelCol)) {
      sectionName = sectionFrom(labelCol, sectionName);
      defaultRoom = explicitRoom(labelCol) || defaultRoom;
    }
    for (const col of timeCols) {
      const raw = (row[col.col] || "").trim();
      if (!raw || SKIP.test(raw)) continue;
      const type = detectType(raw);
      if (type === "LUNCH" || type === "CSR") continue;
      const roomRaw = explicitRoom(raw) || defaultRoom;
      const matched = matchKnown(roomRaw, knownRooms);
      if (matched.warning) warnings.push(`${sectionName} ${DAY_NAMES[day]}: ${matched.warning}`);
      slots.push({
        section: sectionName,
        subject: cleanSubject(raw) || raw.slice(0, 120),
        room: matched.room,
        type: type.slice(0, 20),
        dayOfWeek: day,
        startMin: col.startMin,
        endMin: col.endMin,
      });
    }
  }
  return finish(slots, warnings);
}

function finish(slots: SlotIn[], warnings: string[]): TimetableParse {
  const uniqueWarnings = [...new Set(warnings)].slice(0, 100);
  return { slots, warnings: uniqueWarnings, hardConflicts: detectHardConflicts(slots) };
}

export function labelMinutes(total: number) {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function detectHardConflicts(slots: SlotIn[]): HardConflict[] {
  const conflicts: HardConflict[] = [];
  const seen = new Set<string>();
  const active = slots.filter((slot) => slot.room);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.section === b.section) continue;
      if ((a.room || "").toUpperCase() !== (b.room || "").toUpperCase()) continue;
      if (!(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
      const key = [a.room, a.dayOfWeek, ...[a.section, b.section].sort(), a.startMin, b.startMin].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        type: "ROOM_OVERLAP",
        day: DAY_NAMES[a.dayOfWeek] || String(a.dayOfWeek),
        time: `${labelMinutes(a.startMin)}–${labelMinutes(a.endMin)}`,
        room: a.room || "",
        sections: [...new Set([a.section, b.section])],
        subjects: [`${a.section}: ${a.subject || ""}`, `${b.section}: ${b.subject || ""}`],
      });
    }
  }
  return conflicts;
}

export function parseTimetableCsv(text: string, opts: { knownRooms?: string[]; fileName?: string } = {}): TimetableParse {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvError) throw error;
    throw new CsvError("Could not read this CSV.");
  }
  if (!rows.length) throw new CsvError("The file is empty.");
  const knownRooms = opts.knownRooms ?? [];
  const map = headerIndex(rows[0]);
  if (map) return parseTabular(rows, map, knownRooms, opts.fileName);
  const grid = parseGrid(rows, knownRooms, opts.fileName);
  if (!grid || grid.slots.length === 0) {
    throw new CsvError(
      "Could not find a timetable. Use a Section, Day, Start, End, Subject, Room table, or a grid with days as rows and times as columns.",
    );
  }
  return grid;
}
