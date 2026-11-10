"use server";

import { redirect } from "next/navigation";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { getCurrentUser } from "@/lib/auth/session";
import {
  acceptInvite,
  createInstitution,
  inviteMember,
  removeMember,
  setMemberRole,
  updateInstitution,
} from "@/lib/auth/service";
import { assertFileSize } from "@/lib/api-error";
import { countsFromCsv } from "@/lib/students";
import { decodeUtf8 } from "@/lib/parse/csv";
import { CsvError } from "@/lib/parse/csv";
import { bustTimetable, replaceStrengths } from "@/lib/timetable-repo";
import { RoomInput } from "@/lib/schemas";
import { roomKey } from "@/lib/rooms";
import { parseTimeToMinutes } from "@/lib/time";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/actions/auth";
import type { Role } from "@/lib/auth/roles";

function fromError(error: unknown): ActionState {
  if (error instanceof HttpError) return { error: error.message, fields: error.fields };
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return { error: "That room name is already on this list." };
  }
  console.error("[action]", error);
  return { error: "Something went wrong" };
}

function redirectError(path: string, error: unknown): never {
  const message = error instanceof HttpError ? error.message : "Something went wrong";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createInstitutionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/new");
  let slug = "";
  try {
    const inst = await createInstitution(user.id, {
      name: formData.get("name"),
      slug: formData.get("slug"),
    });
    slug = inst.slug;
  } catch (error) {
    return fromError(error);
  }
  redirect(`/${slug}/manage`);
}

export async function settingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("slug") || "");
  let nextSlug = slug;
  try {
    const { user, inst } = await requireRole(slug, "OWNER");
    const startRaw = String(formData.get("dayStart") || "");
    const endRaw = String(formData.get("dayEnd") || "");
    const startMin = startRaw ? parseTimeToMinutes(startRaw) : inst.dayStartMin;
    const endMin = endRaw ? parseTimeToMinutes(endRaw) : inst.dayEndMin;
    if (startMin < 0 || endMin < 0) return { error: "Opening and closing times must be 24-hour times." };
    const updated = await updateInstitution({
      userId: user.id,
      institutionId: inst.id,
      name: String(formData.get("name") || ""),
      slug: String(formData.get("nextSlug") || ""),
      isPublic: formData.get("isPublic") === "on",
      dayStartMin: startMin,
      dayEndMin: endMin,
      sundayOpen: formData.get("sundayOpen") === "on",
    });
    nextSlug = updated.slug;
    await bustTimetable(inst.id);
  } catch (error) {
    return fromError(error);
  }
  redirect(`/${nextSlug}/manage/settings`);
}

export async function inviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst, role } = await requireRole(slug, "ADMIN");
    if (role !== "OWNER" && role !== "ADMIN") throw new HttpError(403, "You do not have access to do that");
    await inviteMember({
      institutionId: inst.id,
      invitedById: user.id,
      email: String(formData.get("email") || ""),
      role: String(formData.get("role") || "EDITOR"),
      slug,
    });
  } catch (error) {
    return fromError(error);
  }
  redirect(`/${slug}/manage/members?sent=1`);
}

export async function roleAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst, role } = await requireRole(slug, "ADMIN");
    await setMemberRole({
      actorId: user.id,
      actorRole: role as Role,
      institutionId: inst.id,
      userId: String(formData.get("userId") || ""),
      role: String(formData.get("role") || ""),
    });
  } catch (error) {
    redirectError(`/${slug}/manage/members`, error);
  }
  redirect(`/${slug}/manage/members`);
}

export async function removeMemberAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst, role } = await requireRole(slug, "ADMIN");
    await removeMember({
      actorId: user.id,
      actorRole: role,
      institutionId: inst.id,
      userId: String(formData.get("userId") || ""),
    });
  } catch (error) {
    redirectError(`/${slug}/manage/members`, error);
  }
  redirect(`/${slug}/manage/members`);
}

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const token = String(formData.get("token") || "");
  if (!user) redirect(`/login?next=/invite/${token}`);
  let slug = "";
  try {
    slug = await acceptInvite(token, user.id);
  } catch (error) {
    return fromError(error);
  }
  redirect(`/${slug}/manage`);
}

export async function roomAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const floorRaw = String(formData.get("floor") || "");
    const parsed = RoomInput.safeParse({
      name: formData.get("name"),
      building: formData.get("building") || "",
      capacity: formData.get("capacity") || 60,
      isLab: formData.get("isLab") === "on",
      floor: floorRaw,
      hasProjector: formData.get("hasProjector") === "on",
      hasSmartBoard: formData.get("hasSmartBoard") === "on",
      hasAc: formData.get("hasAc") === "on",
    });
    if (!parsed.success) return { error: "Check the room details." };
    const id = String(formData.get("id") || "");
    const key = roomKey(parsed.data.name);
    const existing = await prisma.room.findMany({ where: { institutionId: inst.id } });
    const clash = existing.find((room) => roomKey(room.name) === key && room.id !== id);
    if (clash) {
      const sameText = clash.name.toLowerCase() === parsed.data.name.toLowerCase();
      return {
        error: sameText
          ? `${parsed.data.name} is already on the room list.`
          : `${clash.name} is already listed. ${parsed.data.name} is the same room.`,
      };
    }
    const floor = parsed.data.floor === "" || parsed.data.floor == null ? null : Number(parsed.data.floor);
    const data = {
      name: parsed.data.name,
      building: parsed.data.building || null,
      capacity: parsed.data.capacity,
      isLab: parsed.data.isLab,
      floor,
      hasProjector: parsed.data.hasProjector,
      hasSmartBoard: parsed.data.hasSmartBoard,
      hasAc: parsed.data.hasAc,
    };
    if (id) {
      const room = await prisma.room.findFirst({ where: { id, institutionId: inst.id } });
      if (!room) return { error: "Room not found." };
      await prisma.room.update({ where: { id }, data });
    } else {
      await prisma.room.create({ data: { institutionId: inst.id, ...data } });
    }
    await prisma.retiredRoom.deleteMany({ where: { institutionId: inst.id, roomKey: key } });
    await bustTimetable(inst.id);
  } catch (error) {
    return fromError(error);
  }
  redirect(`/${slug}/manage/rooms`);
}

export async function deleteRoomAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const room = await prisma.room.findFirst({ where: { id: String(formData.get("id") || ""), institutionId: inst.id } });
    if (!room) throw new HttpError(404, "Room not found.");
    await prisma.retiredRoom.upsert({
      where: { institutionId_roomKey: { institutionId: inst.id, roomKey: roomKey(room.name) } },
      update: { name: room.name },
      create: { institutionId: inst.id, roomKey: roomKey(room.name), name: room.name },
    });
    await prisma.room.delete({ where: { id: room.id } });
    await bustTimetable(inst.id);
  } catch (error) {
    redirectError(`/${slug}/manage/rooms`, error);
  }
  redirect(`/${slug}/manage/rooms`);
}

export async function studentsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const file = formData.get("file");
    if (!(file instanceof File)) return { error: "Choose a CSV file." };
    assertFileSize(file.size);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".tsv")) return { error: "Upload a .csv or .tsv file." };
    const text = decodeUtf8(new Uint8Array(await file.arrayBuffer()));
    const counts = countsFromCsv(text);
    if (!counts.length) return { error: "No section column was found. Names are not stored." };
    await replaceStrengths(inst.id, counts);
    await bustTimetable(inst.id);
  } catch (error) {
    if (error instanceof CsvError) return { error: error.message };
    return fromError(error);
  }
  redirect(`/${slug}/manage/students`);
}
