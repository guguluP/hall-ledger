import { createHash } from "crypto";
import type { OccupancySlot } from "@/lib/occupancy";
import { roomKey } from "@/lib/rooms";
import type { ChangeRow } from "@/lib/schedule";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function istStamp(day: number, minutes: number) {
  const anchor = new Date(Date.UTC(2026, 0, 4 + day));
  const utc = new Date(anchor.getTime() + minutes * 60_000 - 330 * 60_000);
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

function dateStamp(iso: string, minutes: number) {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  const utc = new Date(Date.UTC(year, month - 1, day) + minutes * 60_000 - 330 * 60_000);
  return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function uid(parts: string[]) {
  return `${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}@hallledger`;
}

export function icsFor(opts: {
  name: string;
  slots: OccupancySlot[];
  room?: string;
  section?: string;
  changes?: (ChangeRow & { date: string })[];
}) {
  const room = opts.room ? roomKey(opts.room) : "";
  const section = (opts.section || "").trim();
  const slots = opts.slots.filter((slot) => {
    if (room && roomKey(slot.classroomName) !== room) return false;
    if (section && (slot.sectionName || "") !== section) return false;
    return Boolean(slot.classroomName || slot.sectionName);
  });
  const events: string[] = [];
  for (const slot of slots) {
    const day = Number(slot.dayOfWeek);
    const start = slot.startMin ?? 0;
    const end = slot.endMin ?? start + 60;
    const summary = slot.subjectName || slot.sectionName || "Class";
    const cancels = (opts.changes || []).filter((change) => (
      change.kind === "CANCEL"
      && new Date(`${change.date}T00:00:00Z`).getUTCDay() === day
      && change.startMin === start
      && (!change.section || change.section === slot.sectionName)
      && (!change.roomName || roomKey(change.roomName) === roomKey(slot.classroomName))
    ));
    const exdate = cancels.map((change) => dateStamp(change.date, start)).join(",");
    events.push([
      "BEGIN:VEVENT",
      `UID:${uid([opts.name, String(day), String(start), slot.classroomName, slot.sectionName || "", summary])}`,
      `DTSTART:${istStamp(day, start)}`,
      `DTEND:${istStamp(day, end)}`,
      "RRULE:FREQ=WEEKLY",
      exdate ? `EXDATE:${exdate}` : "",
      `SUMMARY:${escapeText(summary)}`,
      `LOCATION:${escapeText(slot.classroomName || "")}`,
      `DESCRIPTION:${escapeText([slot.sectionName, slot.subjectName].filter(Boolean).join(" · "))}`,
      "END:VEVENT",
    ].filter(Boolean).join("\r\n"));
  }
  for (const change of opts.changes || []) {
    if (change.kind === "CANCEL" || !change.roomName) continue;
    if (room && roomKey(change.roomName) !== room && !(change.fromRoom && roomKey(change.fromRoom) === room)) continue;
    if (section && change.section && change.section !== section) continue;
    events.push([
      "BEGIN:VEVENT",
      `UID:${uid(["once", change.date, String(change.startMin), change.roomName, change.section || "", change.kind])}`,
      `DTSTART:${dateStamp(change.date, change.startMin)}`,
      `DTEND:${dateStamp(change.date, change.endMin)}`,
      `SUMMARY:${escapeText(change.subject || change.note || change.kind)}`,
      `LOCATION:${escapeText(change.roomName)}`,
      "END:VEVENT",
    ].join("\r\n"));
  }
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hall Ledger//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
