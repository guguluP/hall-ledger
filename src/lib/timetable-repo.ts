import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http-error";
import { audit } from "@/lib/audit";
import { assertFileSize } from "@/lib/api-error";
import { countAttempts, recordAttempt } from "@/lib/auth/rate-limit";
import { decodeUtf8 } from "@/lib/parse/csv";
import { detectHardConflicts, parseTimetableCsv, type SlotIn } from "@/lib/parse/timetable";
import { DraftSlots } from "@/lib/schemas";
import { buildingOf, isLabRoom } from "@/lib/rooms";
import { fromMinutes } from "@/lib/time";
import type { Role } from "@/lib/auth/roles";

const HOUR = 60 * 60 * 1000;

export type PublishedView = {
  slots: {
    classroomName: string;
    sectionName: string | null;
    subjectName: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    startMin: number;
    endMin: number;
  }[];
  rooms: { name: string; building: string | null; capacity: number; isLab: boolean }[];
  stats: { slots: number; rooms: number; roomsInUse: number; sections: number; conflicts: number };
  source: "published" | "empty";
  fileName: string;
  publishedAt: string | null;
  versionId: string | null;
};

export async function loadPublishedView(institutionId: string): Promise<PublishedView> {
  const timetable = await prisma.timetable.findFirst({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
  const rooms = await prisma.room.findMany({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
  const roomRows = rooms.map((room) => ({
    name: room.name,
    building: room.building,
    capacity: room.capacity,
    isLab: room.isLab,
  }));
  const empty: PublishedView = {
    slots: [],
    rooms: roomRows,
    stats: { slots: 0, rooms: roomRows.length, roomsInUse: 0, sections: 0, conflicts: 0 },
    source: "empty",
    fileName: "",
    publishedAt: null,
    versionId: null,
  };
  if (!timetable?.activeVersionId) return empty;
  const version = await prisma.timetableVersion.findUnique({
    where: { id: timetable.activeVersionId },
    include: { slots: true },
  });
  if (!version || version.status !== "PUBLISHED" || version.timetableId !== timetable.id) return empty;
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const byName = new Map(rooms.map((room) => [room.name.toUpperCase(), room]));
  const slots = version.slots.map((slot) => {
    const linked = slot.roomId ? byId.get(slot.roomId) : undefined;
    const named = slot.roomName ? byName.get(slot.roomName.toUpperCase()) : undefined;
    const classroomName = linked?.name || named?.name || slot.roomName || "";
    return {
      classroomName,
      sectionName: slot.section,
      subjectName: slot.subject,
      dayOfWeek: slot.dayOfWeek,
      startTime: fromMinutes(slot.startMin),
      endTime: fromMinutes(slot.endMin === 1440 ? 0 : slot.endMin),
      startMin: slot.startMin,
      endMin: slot.endMin,
    };
  });
  const listed = new Map(roomRows.map((room) => [room.name.toUpperCase(), room]));
  for (const slot of slots) {
    if (!slot.classroomName || listed.has(slot.classroomName.toUpperCase())) continue;
    listed.set(slot.classroomName.toUpperCase(), {
      name: slot.classroomName,
      building: buildingOf(slot.classroomName),
      capacity: 60,
      isLab: isLabRoom(slot.classroomName),
    });
  }
  const visibleRooms = [...listed.values()];
  const inUse = new Set(slots.map((slot) => slot.classroomName).filter(Boolean));
  return {
    slots,
    rooms: visibleRooms,
    stats: {
      slots: slots.length,
      rooms: visibleRooms.length,
      roomsInUse: inUse.size,
      sections: new Set(slots.map((slot) => slot.sectionName).filter(Boolean)).size,
      conflicts: version.conflictCount,
    },
    source: "published",
    fileName: version.fileName || "",
    publishedAt: version.publishedAt?.toISOString() || null,
    versionId: version.id,
  };
}

export async function bustTimetable(institutionId: string) {
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(`tt:${institutionId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("static generation store")) {
      console.warn("[timetable] revalidate skipped", error);
    }
  }
}

async function pruneDrafts(timetableId: string, keepId: string) {
  const drafts = await prisma.timetableVersion.findMany({
    where: { timetableId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const drop = drafts.filter((draft, index) => draft.id !== keepId && index >= 10).map((draft) => draft.id);
  if (drop.length) await prisma.timetableVersion.deleteMany({ where: { id: { in: drop } } });
}

function isLockError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "P1008" || code === "P2034" || /database is locked|SQLITE_BUSY|timeout/i.test(message);
}

async function withDbRetry<T>(run: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (error instanceof HttpError || !isLockError(error) || attempt === 2) {
        if (isLockError(error)) throw new HttpError(409, "Publish is already in progress");
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw new HttpError(409, "Publish is already in progress");
}

async function mainTimetable(institutionId: string) {
  const existing = await prisma.timetable.findFirst({ where: { institutionId }, orderBy: { name: "asc" } });
  if (existing) return existing;
  return prisma.timetable.create({ data: { institutionId, name: "Main" } });
}

export async function createDraft(opts: {
  institutionId: string;
  userId: string;
  fileName: string;
  bytes: Uint8Array;
}) {
  assertFileSize(opts.bytes.byteLength);
  const uploads = await countAttempts(`upload:${opts.userId}`, HOUR);
  if (uploads >= 30) throw new HttpError(429, "Too many uploads. Try again later.");
  await recordAttempt(`upload:${opts.userId}`);

  const text = decodeUtf8(opts.bytes);
  const rooms = await prisma.room.findMany({ where: { institutionId: opts.institutionId } });
  const parsed = parseTimetableCsv(text, { knownRooms: rooms.map((room) => room.name), fileName: opts.fileName });
  const checked = DraftSlots.safeParse(parsed.slots);
  if (!checked.success) throw new HttpError(400, "The timetable could not be validated.");
  if (!checked.data.length) throw new HttpError(422, "No classes were found in that file.");

  const byName = new Map(rooms.map((room) => [room.name.toUpperCase(), room.id]));
  const timetable = await mainTimetable(opts.institutionId);
  const fileSha256 = createHash("sha256").update(opts.bytes).digest("hex");
  const version = await prisma.timetableVersion.create({
    data: {
      timetableId: timetable.id,
      status: "DRAFT",
      fileName: opts.fileName.slice(0, 180),
      fileSha256,
      createdById: opts.userId,
      conflictCount: parsed.hardConflicts.length,
      warnings: parsed.warnings,
    },
  });
  const rows = checked.data.map((slot) => ({
    versionId: version.id,
    roomId: slot.room ? byName.get(slot.room.toUpperCase()) || null : null,
    roomName: slot.room,
    section: slot.section,
    subject: slot.subject,
    type: slot.type,
    dayOfWeek: slot.dayOfWeek,
    startMin: slot.startMin,
    endMin: slot.endMin,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await prisma.slot.createMany({ data: rows.slice(i, i + 200) });
  }
  await pruneDrafts(timetable.id, version.id);
  return {
    versionId: version.id,
    summary: {
      totalSections: new Set(checked.data.map((slot) => slot.section)).size,
      totalSlots: checked.data.length,
      totalConflicts: parsed.hardConflicts.length,
    },
    warnings: parsed.warnings,
    hardConflicts: parsed.hardConflicts.slice(0, 50),
    fileName: opts.fileName,
  };
}

export async function publishVersionFor(opts: {
  institutionId: string;
  userId: string;
  versionId: string;
  emailVerifiedAt: Date | null;
}) {
  if (!opts.emailVerifiedAt) {
    throw new HttpError(403, "Verify your email before publishing.");
  }
  await withDbRetry(() => prisma.$transaction(async (tx) => {
    const version = await tx.timetableVersion.findUnique({
      where: { id: opts.versionId },
      include: { timetable: true },
    });
    if (!version || version.timetable.institutionId !== opts.institutionId) {
      throw new HttpError(404, "Version not found");
    }
    const current = await tx.timetableVersion.findFirst({
      where: { timetableId: version.timetableId, status: "PUBLISHED", NOT: { id: version.id } },
    });
    if (current) {
      await tx.timetableVersion.update({ where: { id: current.id }, data: { status: "ARCHIVED" } });
    }
    await tx.timetableVersion.update({
      where: { id: version.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await tx.timetable.update({
      where: { id: version.timetableId },
      data: { activeVersionId: version.id },
    });
  }));
  await audit("publish", { userId: opts.userId, institutionId: opts.institutionId, details: opts.versionId });
  await bustTimetable(opts.institutionId);
}

export async function listVersions(institutionId: string) {
  const timetables = await prisma.timetable.findMany({
    where: { institutionId },
    include: { versions: { orderBy: { createdAt: "desc" } } },
  });
  return timetables.flatMap((timetable) =>
    timetable.versions.map((version) => ({
      id: version.id,
      timetable: timetable.name,
      status: version.status,
      fileName: version.fileName,
      createdAt: version.createdAt.toISOString(),
      publishedAt: version.publishedAt?.toISOString() || null,
      conflictCount: version.conflictCount,
      warnings: Array.isArray(version.warnings) ? version.warnings.filter((item) => typeof item === "string") : [],
      active: timetable.activeVersionId === version.id,
    })),
  );
}

export function conflictsOf(slots: SlotIn[]) {
  return detectHardConflicts(slots);
}

export async function replaceStrengths(institutionId: string, counts: { section: string; students: number }[]) {
  await prisma.$transaction(async (tx) => {
    await tx.sectionStrength.deleteMany({ where: { institutionId } });
    if (counts.length) {
      await tx.sectionStrength.createMany({
        data: counts.map((row) => ({ institutionId, section: row.section, students: row.students })),
      });
    }
  });
}

export async function assertLastOwner(institutionId: string, userId: string, nextRole: Role | null) {
  const owners = await prisma.membership.findMany({ where: { institutionId, role: "OWNER" } });
  const isOwner = owners.some((owner) => owner.userId === userId);
  const stillOwner = nextRole === "OWNER";
  if (isOwner && !stillOwner && owners.length <= 1) {
    throw new HttpError(400, "The last owner cannot be removed or demoted.");
  }
}
