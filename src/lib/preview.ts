import type { SlotIn } from "@/lib/parse/timetable";
import { roomKey } from "@/lib/rooms";

export type SlotChange = {
  kind: "added" | "removed" | "changed";
  section: string;
  day: number;
  startMin: number;
  endMin: number;
  before: string;
  after: string;
};

function identity(slot: SlotIn) {
  return [slot.section, slot.dayOfWeek, slot.startMin, slot.endMin].join("|");
}

function detail(slot: SlotIn) {
  return [slot.room || "No room", slot.subject || "No subject", slot.teacher || ""].filter(Boolean).join(" · ");
}

export function diffSlots(live: SlotIn[], draft: SlotIn[]): SlotChange[] {
  const liveMap = new Map(live.map((slot) => [identity(slot), slot]));
  const draftMap = new Map(draft.map((slot) => [identity(slot), slot]));
  const changes: SlotChange[] = [];
  for (const [key, slot] of draftMap) {
    const previous = liveMap.get(key);
    if (!previous) {
      changes.push({ kind: "added", section: slot.section, day: slot.dayOfWeek, startMin: slot.startMin, endMin: slot.endMin, before: "", after: detail(slot) });
      continue;
    }
    const roomChanged = roomKey(previous.room) !== roomKey(slot.room);
    const subjectChanged = (previous.subject || "") !== (slot.subject || "");
    const teacherChanged = (previous.teacher || "") !== (slot.teacher || "");
    if (roomChanged || subjectChanged || teacherChanged) {
      changes.push({ kind: "changed", section: slot.section, day: slot.dayOfWeek, startMin: slot.startMin, endMin: slot.endMin, before: detail(previous), after: detail(slot) });
    }
  }
  for (const [key, slot] of liveMap) {
    if (draftMap.has(key)) continue;
    changes.push({ kind: "removed", section: slot.section, day: slot.dayOfWeek, startMin: slot.startMin, endMin: slot.endMin, before: detail(slot), after: "" });
  }
  return changes.sort((a, b) => a.day - b.day || a.startMin - b.startMin || a.section.localeCompare(b.section));
}
