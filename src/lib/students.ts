import { parseCsv } from "@/lib/parse/csv";

export type SectionCount = {
  section: string;
  students: number;
};

export type MergeProposal = {
  from: string;
  into: string;
  fromCount: number;
  intoCount: number;
  combined: number;
  reason: string;
};

const MERGE_BELOW = 25;

export const DEMO_SECTIONS: SectionCount[] = [
  { section: "SECTION-A", students: 58 },
  { section: "SECTION-B", students: 61 },
  { section: "SECTION-C", students: 54 },
  { section: "SECTION-D", students: 22 },
  { section: "SECTION-E", students: 18 },
  { section: "SECTION-F", students: 60 },
  { section: "SECTION-G", students: 57 },
  { section: "SECTION-H", students: 55 },
  { section: "SECTION-I", students: 52 },
  { section: "SECTION-J", students: 49 },
  { section: "SECTION-K", students: 47 },
  { section: "SECTION-L", students: 44 },
  { section: "SECTION-M", students: 51 },
  { section: "SECTION-N", students: 16 },
  { section: "SECTION-O", students: 21 },
  { section: "SECTION-P", students: 53 },
];

function headerKey(value: string): "section" | "count" | "person" | null {
  const text = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!text) return null;
  if (text === "students" || text === "count" || text === "strength" || text === "enrollment") return "count";
  if (text.includes("section") || text === "sec" || text === "class" || text === "batch") return "section";
  if (text.includes("roll") || text.includes("name") || text === "student") return "person";
  return null;
}

export function canonSection(raw: string) {
  const text = raw.trim().toUpperCase();
  const match = text.match(/SEC(?:TION)?[-_ ]?([A-Z0-9]+)/);
  if (match) return `SECTION-${match[1]}`.slice(0, 40);
  if (/^[A-Z]$/.test(text)) return `SECTION-${text}`;
  return text;
}

/** Counts only. Names and roll numbers are not returned. */
export function countsFromCsv(text: string): SectionCount[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  let headerAt = 0;
  const map: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const found: Record<string, number> = {};
    rows[i].forEach((cell, col) => {
      const key = headerKey(cell);
      if (key && found[key] == null) found[key] = col;
    });
    if (found.section != null) {
      headerAt = i;
      Object.assign(map, found);
      break;
    }
  }
  if (map.section == null) return [];
  const totals = new Map<string, number>();
  for (let i = headerAt + 1; i < rows.length; i++) {
    const row = rows[i];
    const section = canonSection(row[map.section] || "");
    if (!section || section.length > 40) continue;
    if (map.count != null && map.person == null) {
      const count = parseInt(row[map.count] || "", 10);
      if (!Number.isFinite(count) || count < 0) continue;
      totals.set(section, count);
      continue;
    }
    const marker = map.person != null ? row[map.person] || "" : row.find((cell, index) => index !== map.section && cell.trim()) || "";
    if (!marker.trim() && map.person != null) continue;
    totals.set(section, (totals.get(section) || 0) + 1);
  }
  return [...totals.entries()]
    .map(([section, students]) => ({ section, students }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

export function proposeMerges(sections: SectionCount[]): MergeProposal[] {
  const small = sections.filter((section) => section.students > 0 && section.students < MERGE_BELOW);
  const used = new Set<string>();
  const out: MergeProposal[] = [];
  for (const candidate of small) {
    if (used.has(candidate.section)) continue;
    const partner = sections
      .filter((section) => section.section !== candidate.section && !used.has(section.section))
      .sort((a, b) => a.students - b.students)[0];
    if (!partner) continue;
    used.add(candidate.section);
    used.add(partner.section);
    const [from, into] = candidate.students <= partner.students ? [candidate, partner] : [partner, candidate];
    out.push({
      from: from.section,
      into: into.section,
      fromCount: from.students,
      intoCount: into.students,
      combined: from.students + into.students,
      reason: `${from.section} has ${from.students} students (below ${MERGE_BELOW}). Merge into ${into.section}.`,
    });
  }
  return out;
}
