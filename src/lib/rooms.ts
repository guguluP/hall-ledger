/** Every hall that appears in the 1st-year 2025–26 workbook */
export const FULL_TIMETABLE_ROOMS = [
  "10",
  "105",
  "106",
  "107",
  "207",
  "301",
  "302",
  "304",
  "314",
  "316",
  "317",
  "318",
  "319",
  "320",
  "321",
  "322",
  "402",
  "404",
  "405",
  "ME-01",
  "ME-02",
  "ME-03",
  "ME-04",
  "ME-101",
  "ME-102",
  "ME-103",
  "ME-104",
] as const;

export type TimetableRoomName = (typeof FULL_TIMETABLE_ROOMS)[number];
export type Campus = "Aryabhatta" | "Kautalya";

const LAB_ROOMS = new Set([
  "105",
  "107",
  "207",
  "302",
  "304",
  "322",
  "402",
  "ME-LAB",
]);

export function inferCampus(sheetName: string, extra = ""): Campus {
  return /kautalya/i.test(sheetName + " " + extra) ? "Kautalya" : "Aryabhatta";
}

export function isLabRoom(name: string | null | undefined): boolean {
  if (!name) return false;
  const t = name.trim().toUpperCase().replace(/\s+/g, "");
  if (LAB_ROOMS.has(t)) return true;
  return /LAB/.test(t);
}

export function isValidRoom(r: string | null | undefined): r is string {
  if (!r) return false;
  const t = r.trim().toUpperCase().replace(/\s+/g, "");
  if (!t || t === "-" || t === "TBD" || t === "NA" || t === "N/A") return false;
  if (/^(PP|PR|TUT|LAB|SKILL|CSR|LUNCH|MAC)$/.test(t)) return false;
  if (/^ME-?LAB\b/.test(t)) return true;
  if (/^ME-?\d{1,3}$/.test(t)) return true;
  if (/^[A-Z]{1,4}-?\d{1,4}$/.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return parseInt(t, 10) >= 10;
  if (t.length >= 2 && t.length <= 40 && /[A-Z]/.test(t)) return true;
  return false;
}

export function canonicalRoom(
  raw: string | null | undefined,
  campus: Campus = "Aryabhatta",
): string | null {
  if (!raw) return null;
  const original = raw.trim();
  let t = original.toUpperCase().replace(/\s+/g, "");
  t = t.replace(/O(\d)/g, "0$1");
  if (!t || t === "-" || t === "TBD") return null;
  if (/^ME-?LAB/.test(t)) return "ME-LAB";
  if (/^ME\d+$/.test(t)) t = "ME-" + t.slice(2);
  if (/^ME-\d+$/.test(t)) {
    const n = t.slice(3);
    return n.length === 1 ? `ME-0${n}` : `ME-${n}`;
  }
  if (!/^\d{1,4}$/.test(t)) {
    if (isValidRoom(original)) {
      if (/\s/.test(original) || /[a-zA-Z]{4,}/.test(original)) {
        return original.replace(/\s+/g, " ").trim();
      }
      return t;
    }
    return null;
  }

  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n <= 0) return null;

  if (campus === "Kautalya") {
    if (n >= 1 && n <= 4) return `ME-0${n}`;
    if (n >= 101 && n <= 104) return `ME-${n}`;
  }

  if (n >= 1 && n <= 4) return `ME-0${n}`;
  if (t.startsWith("0") && t.length <= 3) {
    return `ME-${t.slice(1).padStart(2, "0")}`;
  }
  if (n >= 101 && n <= 104 && campus === "Kautalya") return `ME-${n}`;
  if (t.length === 1) return null;
  return String(n);
}

export function roomsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const variants = (x: string) => {
    return new Set(
      [
        x.trim().toUpperCase().replace(/\s+/g, ""),
        canonicalRoom(x, "Aryabhatta"),
        canonicalRoom(x, "Kautalya"),
      ].filter((v): v is string => !!v).map((v) => v.toUpperCase().replace(/\s+/g, "")),
    );
  };
  const A = variants(a);
  const B = variants(b);
  for (const v of A) if (B.has(v)) return true;
  return false;
}

export function buildingOf(name: string): string {
  return /^ME/i.test(name) ? "Kautalya" : "Aryabhatta";
}
