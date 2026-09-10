/**
 * Published timetable store — works without Postgres on Vercel.
 * Falls back to the bundled 2025–26 seed so Grid/Find work before an upload.
 * Clients also cache the payload in localStorage (see client-cache.ts)
 * because serverless instances do not share /tmp.
 */
import { promises as fs } from "fs";
import path from "path";
import { buildingOf } from "./rooms";
import { padTime } from "./time";
import defaultTimetable from "@/data/default-timetable.json";

export type PublishedSlot = {
  classroomName: string;
  sectionName: string | null;
  subjectName: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

export type PublishedPayload = {
  origin?: "seed" | "upload";
  publishedAt: string;
  fileName?: string;
  slots: PublishedSlot[];
  rooms: { name: string; building: string; capacity: number }[];
  stats: {
    sections: number;
    slots: number;
    rooms: number;
    roomsInUse: number;
    conflicts: number;
  };
};

const TMP = path.join("/tmp", "hall-ledger-published.json");

type GlobalStore = { __hallLedgerPublished?: PublishedPayload | null };
const g = globalThis as unknown as GlobalStore;

export function defaultPublished(): PublishedPayload {
  return { ...(defaultTimetable as PublishedPayload), origin: "seed" };
}

export async function savePublished(payload: PublishedPayload): Promise<void> {
  const next = { ...payload, origin: "upload" as const };
  g.__hallLedgerPublished = next;
  try {
    await fs.writeFile(TMP, JSON.stringify(next), "utf8");
  } catch (e) {
    console.warn("[published-store] /tmp write failed", e);
  }
}

export async function loadPublished(): Promise<PublishedPayload | null> {
  if (g.__hallLedgerPublished?.slots?.length) {
    return g.__hallLedgerPublished;
  }
  try {
    const raw = await fs.readFile(TMP, "utf8");
    const data = JSON.parse(raw) as PublishedPayload;
    if (data?.slots?.length) {
      g.__hallLedgerPublished = data;
      return data;
    }
  } catch {
    // no override yet
  }
  return defaultPublished();
}

export function slotsFromParse(parse: any): PublishedSlot[] {
  const raw = (parse?.allSlots ?? []) as any[];
  return raw
    .map((s) => ({
      classroomName: String(s.room || s.roomOverride || "").trim(),
      sectionName: s.section ? String(s.section) : null,
      subjectName: s.subject || s.subjectRaw || null,
      dayOfWeek: typeof s.dayOfWeek === "number" ? s.dayOfWeek : null,
      startTime: padTime(String(s.startTime || "")),
      endTime: padTime(String(s.endTime || "")),
    }))
    .filter((s) => s.startTime && s.dayOfWeek != null);
}

export function roomsFromSlots(
  slots: PublishedSlot[],
  fullRooms: readonly string[],
): { name: string; building: string; capacity: number }[] {
  const usage = new Map<string, number>();
  for (const s of slots) {
    if (!s.classroomName) continue;
    usage.set(s.classroomName, (usage.get(s.classroomName) || 0) + 1);
  }
  const names = new Set<string>([...fullRooms]);
  for (const n of usage.keys()) names.add(n);

  return [...names]
    .map((name) => ({
      name,
      building: buildingOf(name),
      capacity: 60,
      usage: usage.get(name) || 0,
    }))
    .sort((a, b) => {
      if (b.usage !== a.usage) return b.usage - a.usage;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    })
    .map(({ name, building, capacity }) => ({ name, building, capacity }));
}
