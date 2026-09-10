export type StudentRow = {
  section: string;
  roll: string;
  name: string;
  campus: string;
};

export type SectionEnrollment = {
  section: string;
  campus: string;
  count: number;
  students: StudentRow[];
};

export type MergeProposal = {
  from: string;
  into: string;
  fromCount: number;
  intoCount: number;
  combined: number;
  reason: string;
};

const STORAGE_KEY = "hall-ledger-students-v1";
const MERGE_BELOW = 25;

export const DEMO_SECTIONS: { section: string; campus: string; count: number }[] = [
  { section: "SECTION-A", campus: "Aryabhatta", count: 58 },
  { section: "SECTION-B", campus: "Aryabhatta", count: 61 },
  { section: "SECTION-C", campus: "Aryabhatta", count: 54 },
  { section: "SECTION-D", campus: "Aryabhatta", count: 22 },
  { section: "SECTION-E", campus: "Aryabhatta", count: 18 },
  { section: "SECTION-F", campus: "Kautalya", count: 60 },
  { section: "SECTION-G", campus: "Kautalya", count: 57 },
  { section: "SECTION-H", campus: "Kautalya", count: 55 },
  { section: "SECTION-I", campus: "Kautalya", count: 52 },
  { section: "SECTION-J", campus: "Kautalya", count: 49 },
  { section: "SECTION-K", campus: "Kautalya", count: 47 },
  { section: "SECTION-L", campus: "Kautalya", count: 44 },
  { section: "SECTION-M", campus: "Aryabhatta", count: 51 },
  { section: "SECTION-N", campus: "Kautalya", count: 16 },
  { section: "SECTION-O", campus: "Kautalya", count: 21 },
  { section: "SECTION-P", campus: "Kautalya", count: 53 },
];

export function saveStudents(rows: StudentRow[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
  } catch {
    // quota
  }
}

export function loadStudents(): StudentRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data?.rows) && data.rows.length) return data.rows as StudentRow[];
    return null;
  } catch {
    return null;
  }
}

function headerKey(h: string): "section" | "roll" | "name" | "campus" | null {
  const t = h.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (/^(section|sec|class|batch)$/.test(t) || t.includes("section")) return "section";
  if (/^(roll|rollno|rollnumber|regd|regno|id)$/.test(t) || t.includes("roll")) return "roll";
  if (/^(name|student|studentname|fullname)$/.test(t) || t.includes("name")) return "name";
  if (/^(campus|college|block|building)$/.test(t)) return "campus";
  return null;
}

function canonSection(raw: string): string {
  const t = raw.trim().toUpperCase();
  const m = t.match(/SEC(?:TION)?[-_ ]?([A-Z0-9]+)/);
  if (m) return "SECTION-" + m[1];
  if (/^[A-Z]$/.test(t)) return "SECTION-" + t;
  return t || "UNASSIGNED";
}

export function parseStudentGrid(rows: unknown[][]): StudentRow[] {
  if (!rows.length) return [];
  let headerIdx = 0;
  let map: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = (rows[i] || []).map((c) => String(c || "").trim());
    const found: Record<string, number> = {};
    row.forEach((cell, col) => {
      const k = headerKey(cell);
      if (k && found[k] == null) found[k] = col;
    });
    if (found.section != null && (found.roll != null || found.name != null)) {
      headerIdx = i;
      map = found;
      break;
    }
  }
  if (map.section == null) return [];

  const out: StudentRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = (rows[i] || []).map((c) => String(c || "").trim());
    const section = canonSection(row[map.section] || "");
    if (!section || section === "UNASSIGNED") continue;
    const roll = map.roll != null ? row[map.roll] || "" : "";
    const name = map.name != null ? row[map.name] || "" : "";
    if (!roll && !name) continue;
    const campus = map.campus != null ? row[map.campus] : /ME-|KAUTALYA|[F-LNO]/i.test(section) ? "Kautalya" : "Aryabhatta";
    out.push({ section, roll, name, campus });
  }
  return out;
}

export function enrollmentsFrom(rows: StudentRow[]): SectionEnrollment[] {
  const map = new Map<string, SectionEnrollment>();
  for (const r of rows) {
    const cur = map.get(r.section) || {
      section: r.section,
      campus: r.campus,
      count: 0,
      students: [],
    };
    cur.count += 1;
    cur.students.push(r);
    if (!cur.campus && r.campus) cur.campus = r.campus;
    map.set(r.section, cur);
  }
  return [...map.values()].sort((a, b) => a.section.localeCompare(b.section));
}

export function demoEnrollments(): SectionEnrollment[] {
  return DEMO_SECTIONS.map((s) => ({
    section: s.section,
    campus: s.campus,
    count: s.count,
    students: [],
  }));
}

export function proposeMerges(sections: SectionEnrollment[]): MergeProposal[] {
  const small = sections.filter((s) => s.count > 0 && s.count < MERGE_BELOW);
  const out: MergeProposal[] = [];
  const used = new Set<string>();
  for (const a of small) {
    if (used.has(a.section)) continue;
    const partner = sections
      .filter((b) => b.section !== a.section && b.campus === a.campus && !used.has(b.section))
      .sort((x, y) => x.count - y.count)[0];
    if (!partner) continue;
    used.add(a.section);
    used.add(partner.section);
    const [from, into] = a.count <= partner.count ? [a, partner] : [partner, a];
    out.push({
      from: from.section,
      into: into.section,
      fromCount: from.count,
      intoCount: into.count,
      combined: from.count + into.count,
      reason: `${from.section} has ${from.count} students (below ${MERGE_BELOW}). Merge into ${into.section} on ${from.campus}.`,
    });
  }
  return out;
}
