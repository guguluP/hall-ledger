import { CsvError, parseCsv } from "@/lib/parse/csv";
import { roomKey } from "@/lib/rooms";
import { labelTime, parseClassRange } from "@/lib/time";

export type SlotIn = {
  section: string;
  subject: string | null;
  room: string | null;
  teacher: string | null;
  type: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
};

export type HardConflict = {
  type: "ROOM_OVERLAP" | "SECTION_OVERLAP" | "TEACHER_OVERLAP";
  day: string;
  time: string;
  room: string;
  sections: string[];
  subjects: string[];
  teacher?: string;
};

export type TimetableParse = {
  slots: SlotIn[];
  warnings: string[];
  hardConflicts: HardConflict[];
  clashes: HardConflict[];
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
  teacher: "teacher",
  faculty: "teacher",
  instructor: "teacher",
  staff: "teacher",
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

function oneDay(value: string): number | null {
  const text = value.trim().toLowerCase().replace(/\./g, "");
  if (!text) return null;
  if (/^[0-6]$/.test(text)) return Number(text);
  return Object.prototype.hasOwnProperty.call(DAY_MAP, text) ? DAY_MAP[text] : null;
}

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function daysFrom(value: string): { days: number[]; warning?: string } {
  const text = value.trim();
  if (!text) return { days: [] };
  const parts = text.split(/\s*(?:\/|&|,|\+|\band\b)\s*/i).filter(Boolean);
  if (parts.length > 1) {
    const days: number[] = [];
    const bad: string[] = [];
    for (const part of parts) {
      const day = oneDay(part);
      if (day == null) bad.push(part);
      else if (!days.includes(day)) days.push(day);
    }
    const listed = days.map((day) => DAY_LABELS[day]).join(" and ");
    if (!days.length) return { days: [], warning: `Unrecognized day "${text}".` };
    if (bad.length) {
      return { days, warning: `"${text}" was read as ${listed}. Unrecognized: ${bad.join(", ")}.` };
    }
    return { days, warning: `"${text}" was read as ${listed}.` };
  }
  const day = oneDay(text);
  if (day == null) return { days: [], warning: `Unrecognized day "${text}".` };
  return { days: [day] };
}

function rangeFrom(cell: string) {
  return parseClassRange(cell);
}

function sectionFrom(raw: string, fallback: string) {
  const text = raw.trim();
  const match = text.match(/SEC(?:TION)?[-_ ]?([A-Z0-9]+)/i);
  if (match) return `SECTION-${match[1].toUpperCase()}`;
  if (/^[A-Za-z]$/.test(text)) return `SECTION-${text.toUpperCase()}`;
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function keepSection(section: string, warnings: string[], where: string) {
  if (section.length <= 40) return section;
  warnings.push(`${where}: section name is longer than 40 characters and was skipped.`);
  return null;
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
  const rn = src.match(/\bR\.?\s*N(?:o)?\.?\s*[:-]*\s*([A-Za-z0-9-]{1,8})/i);
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
    .replace(/\bR\.?\s*N(?:o)?\.?\s*[:-]*\s*[A-Za-z0-9-]{1,8}/gi, "")
    .replace(/Room\s*No\.?\s*[:-]*\s*\d{1,4}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

const SKIP = /^(lunch|csr(\s+activity)?|mentoring|hod\s+interaction|dean\s+interaction|-)?$/i;

function matchKnown(raw: string | null, knownRooms: string[]): { room: string | null; warning?: string } {
  if (!raw) return { room: null };
  const hit = knownRooms.find((room) => roomKey(room) === roomKey(raw));
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
    const parsedDays = daysFrom(row[map.day] || "");
    if (!parsedDays.days.length) {
      warnings.push(parsedDays.warning || `Row ${i + 1} has an unrecognized day.`);
      continue;
    }
    if (parsedDays.warning) warnings.push(`Row ${i + 1}: ${parsedDays.warning}`);
    let startMin = -1;
    let endMin = -1;
    let assumedPm = false;
    if (map.time != null) {
      const range = rangeFrom(row[map.time] || "");
      if (!range) {
        warnings.push(`Row ${i + 1} has an unrecognized time.`);
        continue;
      }
      startMin = range.startMin;
      endMin = range.endMin;
      assumedPm = range.assumedPm;
    } else {
      const range = rangeFrom(`${row[map.start] || ""}-${row[map.end] || ""}`);
      if (!range) {
        warnings.push(`Row ${i + 1}: end must be after start.`);
        continue;
      }
      startMin = range.startMin;
      endMin = range.endMin;
      assumedPm = range.assumedPm;
    }
    if (assumedPm) {
      warnings.push(`Row ${i + 1}: ${labelTime(startMin)}–${labelTime(endMin)} was read as an afternoon class.`);
    }
    const section = sectionFrom(map.section != null ? row[map.section] || "" : "", fallback);
    const kept = keepSection(section, warnings, `Row ${i + 1}`);
    if (!kept || kept === "SECTION") {
      if (!kept) continue;
      warnings.push(`Row ${i + 1} is missing a section.`);
      continue;
    }
    const subjectRaw = map.subject != null ? (row[map.subject] || "").trim() : "";
    const roomRaw = map.room != null ? (row[map.room] || "").trim() : "";
    const matched = matchKnown(roomRaw || null, knownRooms);
    if (matched.warning) warnings.push(`Row ${i + 1}: ${matched.warning}`);
    const typeRaw = map.type != null ? (row[map.type] || "").trim() : detectType(subjectRaw);
    const teacherRaw = map.teacher != null ? (row[map.teacher] || "").trim().slice(0, 80) : "";
    for (const day of parsedDays.days) {
      slots.push({
        section: kept,
        subject: subjectRaw ? cleanSubject(subjectRaw) || subjectRaw.slice(0, 120) : null,
        room: matched.room,
        teacher: teacherRaw || null,
        type: (typeRaw || "CLASS").slice(0, 20),
        dayOfWeek: day,
        startMin,
        endMin,
      });
    }
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
    const parsedDays = daysFrom(row[0] || "");
    if (!parsedDays.days.length) {
      const label = row.find((cell) => /SECTION/i.test(cell)) || "";
      if (label) {
        sectionName = sectionFrom(label, sectionName);
        defaultRoom = explicitRoom(label);
      } else if (parsedDays.warning) {
        warnings.push(parsedDays.warning);
      }
      continue;
    }
    if (parsedDays.warning) warnings.push(parsedDays.warning);
    const labelCol = row[1] || "";
    if (/SECTION/i.test(labelCol)) {
      sectionName = sectionFrom(labelCol, sectionName);
      defaultRoom = explicitRoom(labelCol);
    }
    for (const day of parsedDays.days) {
      for (const col of timeCols) {
        const raw = (row[col.col] || "").trim();
        if (!raw || SKIP.test(raw)) continue;
        const type = detectType(raw);
        if (type === "LUNCH" || type === "CSR") continue;
        const roomRaw = explicitRoom(raw) || defaultRoom;
        const matched = matchKnown(roomRaw, knownRooms);
        const kept = keepSection(sectionName, warnings, `${DAY_NAMES[day]}`);
        if (!kept) continue;
        if (matched.warning) warnings.push(`${kept} ${DAY_NAMES[day]}: ${matched.warning}`);
        slots.push({
          section: kept,
          subject: cleanSubject(raw) || raw.slice(0, 120),
          room: matched.room,
          teacher: null,
          type: type.slice(0, 20),
          dayOfWeek: day,
          startMin: col.startMin,
          endMin: col.endMin,
        });
      }
    }
  }
  return finish(slots, warnings);
}

function finish(slots: SlotIn[], warnings: string[]): TimetableParse {
  const uniqueWarnings = [...new Set(warnings)].slice(0, 100);
  return {
    slots,
    warnings: uniqueWarnings,
    hardConflicts: detectHardConflicts(slots),
    clashes: detectClashes(slots),
  };
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
      const keyRoom = roomKey(a.room);
      if (!keyRoom || keyRoom !== roomKey(b.room)) continue;
      if (!(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
      const key = [keyRoom, a.dayOfWeek, ...[a.section, b.section].sort(), a.startMin, b.startMin].join("|");
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

export function detectClashes(slots: SlotIn[]): HardConflict[] {
  const conflicts: HardConflict[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (!(a.startMin < b.endMin && b.startMin < a.endMin)) continue;
      if (a.section === b.section && roomKey(a.room) !== roomKey(b.room)) {
        const key = ["S", a.section, a.dayOfWeek, a.startMin, b.startMin, roomKey(a.room), roomKey(b.room)].join("|");
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({
            type: "SECTION_OVERLAP",
            day: DAY_NAMES[a.dayOfWeek] || String(a.dayOfWeek),
            time: `${labelMinutes(a.startMin)}–${labelMinutes(a.endMin)}`,
            room: [a.room, b.room].filter(Boolean).join(" / "),
            sections: [a.section],
            subjects: [`${a.room || "no room"}: ${a.subject || ""}`, `${b.room || "no room"}: ${b.subject || ""}`],
          });
        }
      }
      const teacherA = (a.teacher || "").trim();
      const teacherB = (b.teacher || "").trim();
      if (teacherA && teacherB && teacherA.toLowerCase() === teacherB.toLowerCase() && a.section !== b.section) {
        const key = ["T", teacherA.toLowerCase(), a.dayOfWeek, a.startMin, b.startMin, a.section, b.section].join("|");
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({
            type: "TEACHER_OVERLAP",
            day: DAY_NAMES[a.dayOfWeek] || String(a.dayOfWeek),
            time: `${labelMinutes(a.startMin)}–${labelMinutes(a.endMin)}`,
            room: [a.room, b.room].filter(Boolean).join(" / "),
            sections: [...new Set([a.section, b.section])],
            subjects: [`${a.section}: ${a.subject || ""}`, `${b.section}: ${b.subject || ""}`],
            teacher: teacherA,
          });
        }
      }
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
