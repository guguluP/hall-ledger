"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authz";
import { HttpError } from "@/lib/http-error";
import { notifyMembers } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { roomKey } from "@/lib/rooms";
import { dayOfDate } from "@/lib/schedule";
import { fetchSheetCsv } from "@/lib/sheets";
import { createDraft } from "@/lib/timetable-repo";
import { clientIpFrom } from "@/lib/auth/client-ip";
import { headers } from "next/headers";
import { assertIpLimit, recordAttempt } from "@/lib/auth/rate-limit";

function minutesOf(value: FormDataEntryValue | null) {
  const match = String(value || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function redirectError(path: string, error: unknown): never {
  const message = error instanceof HttpError ? error.message : "Something went wrong";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function closureAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "EDITOR");
    const startDate = String(formData.get("startDate") || "");
    const endDate = String(formData.get("endDate") || startDate);
    const kind = String(formData.get("kind") || "HOLIDAY");
    const label = String(formData.get("label") || "").trim().slice(0, 80);
    if (dayOfDate(startDate) == null) throw new HttpError(400, "Enter a start date.");
    if (dayOfDate(endDate) == null || endDate < startDate) throw new HttpError(400, "The end date must be on or after the start.");
    if (!["HOLIDAY", "EXAM", "CLOSED"].includes(kind) || !label) throw new HttpError(400, "Name the closure and choose a kind.");
    await prisma.closure.create({ data: { institutionId: inst.id, startDate, endDate, kind, label } });
  } catch (error) {
    redirectError(`/${slug}/manage/calendar`, error);
  }
  redirect(`/${slug}/manage/calendar`);
}

export async function deleteClosureAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "EDITOR");
    await prisma.closure.deleteMany({ where: { id: String(formData.get("id") || ""), institutionId: inst.id } });
  } catch (error) {
    redirectError(`/${slug}/manage/calendar`, error);
  }
  redirect(`/${slug}/manage/calendar`);
}

export async function changeAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst } = await requireRole(slug, "EDITOR");
    const date = String(formData.get("date") || "");
    const kind = String(formData.get("kind") || "");
    const startMin = minutesOf(formData.get("start"));
    const endMin = minutesOf(formData.get("end"));
    if (dayOfDate(date) == null || !["CANCEL", "SWAP", "EVENT"].includes(kind) || startMin == null || endMin == null || endMin <= startMin) {
      throw new HttpError(400, "Choose a date, a kind, and a time range.");
    }
    const roomName = String(formData.get("room") || "").trim().slice(0, 20) || null;
    const fromRoom = String(formData.get("fromRoom") || "").trim().slice(0, 20) || null;
    if (kind !== "CANCEL" && !roomName) throw new HttpError(400, "Name the room.");
    const change = await prisma.scheduleChange.create({
      data: {
        institutionId: inst.id,
        date,
        kind,
        section: String(formData.get("section") || "").trim().slice(0, 40) || null,
        subject: String(formData.get("subject") || "").trim().slice(0, 120) || null,
        teacher: String(formData.get("teacher") || "").trim().slice(0, 80) || null,
        roomName,
        fromRoom,
        startMin,
        endMin,
        note: String(formData.get("note") || "").trim().slice(0, 160) || null,
        createdById: user.id,
      },
    });
    await notifyMembers(inst.id, `${inst.name}: timetable change`, `${kind} on ${date} for ${change.section || change.roomName || "a class"}.`, `/${inst.slug}/find`);
  } catch (error) {
    redirectError(`/${slug}/manage/changes`, error);
  }
  redirect(`/${slug}/manage/changes`);
}

export async function deleteChangeAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "EDITOR");
    await prisma.scheduleChange.deleteMany({ where: { id: String(formData.get("id") || ""), institutionId: inst.id } });
  } catch (error) {
    redirectError(`/${slug}/manage/changes`, error);
  }
  redirect(`/${slug}/manage/changes`);
}

export async function bookingAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst } = await requireRole(slug, "VIEWER");
    const date = String(formData.get("date") || "");
    const startMin = minutesOf(formData.get("start"));
    const endMin = minutesOf(formData.get("end"));
    const roomName = String(formData.get("room") || "").trim().slice(0, 20);
    const purpose = String(formData.get("purpose") || "").trim().slice(0, 160);
    if (dayOfDate(date) == null || startMin == null || endMin == null || endMin <= startMin || !roomName || purpose.length < 3) {
      throw new HttpError(400, "Enter a room, a date, a time, and what the room is for.");
    }
    await prisma.bookingRequest.create({
      data: { institutionId: inst.id, roomName, date, startMin, endMin, purpose, requesterId: user.id },
    });
  } catch (error) {
    redirectError(`/${slug}/manage/bookings`, error);
  }
  redirect(`/${slug}/manage/bookings`);
}

export async function bookingDecisionAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const status = String(formData.get("status") || "");
    if (status !== "APPROVED" && status !== "REJECTED") throw new HttpError(400, "Choose approve or reject.");
    const updated = await prisma.bookingRequest.updateMany({
      where: { id: String(formData.get("id") || ""), institutionId: inst.id, status: "PENDING" },
      data: { status },
    });
    if (!updated.count) throw new HttpError(404, "That request is no longer pending.");
    if (status === "APPROVED") {
      await notifyMembers(inst.id, `${inst.name}: room booking approved`, "An approved booking now occupies a room.", `/${inst.slug}/find`);
    }
  } catch (error) {
    redirectError(`/${slug}/manage/bookings`, error);
  }
  redirect(`/${slug}/manage/bookings`);
}

export async function observationAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst } = await requireRole(slug, "ADMIN");
    const roomName = String(formData.get("room") || "").trim().slice(0, 20);
    const headRaw = String(formData.get("headcount") || "");
    const headcount = headRaw ? Number(headRaw) : null;
    if (!roomName) throw new HttpError(400, "Name the room.");
    if (headcount != null && (!Number.isInteger(headcount) || headcount < 0 || headcount > 500)) {
      throw new HttpError(400, "Headcount must be a whole number.");
    }
    await prisma.occupancyNote.create({
      data: {
        institutionId: inst.id,
        roomName,
        occupied: formData.get("occupied") === "on",
        headcount,
        source: "manual",
        createdById: user.id,
      },
    });
  } catch (error) {
    redirectError(`/${slug}/manage/usage`, error);
  }
  redirect(`/${slug}/manage/usage`);
}

export async function alertAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst } = await requireRole(slug, "VIEWER");
    await prisma.alertPreference.upsert({
      where: { institutionId_userId: { institutionId: inst.id, userId: user.id } },
      update: { email: formData.get("email") === "on" },
      create: { institutionId: inst.id, userId: user.id, email: formData.get("email") === "on" },
    });
  } catch (error) {
    redirectError(`/${slug}/manage/settings`, error);
  }
  redirect(`/${slug}/manage`);
}

export async function sheetImportAction(formData: FormData) {
  const slug = String(formData.get("slug") || "");
  try {
    const { user, inst } = await requireRole(slug, "EDITOR");
    const headerList = await headers();
    const ip = clientIpFrom((name) => headerList.get(name));
    await assertIpLimit(`sheet:${user.id}:${ip}`, 10, 60 * 60 * 1000);
    const csv = await fetchSheetCsv(String(formData.get("url") || ""));
    await recordAttempt(`sheet:${user.id}:${ip}`);
    const draft = await createDraft({
      institutionId: inst.id,
      userId: user.id,
      fileName: "google-sheet.csv",
      bytes: new TextEncoder().encode(csv),
    });
    redirect(`/${inst.slug}/manage/versions/${draft.versionId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    redirectError(`/${slug}/manage/upload`, error);
  }
}

export async function reportRoom(slug: string, roomName: string, kind: string) {
  try {
    const { visibleInstitution } = await import("@/lib/auth/authz");
    const inst = await visibleInstitution(slug);
    if (!inst) return { error: "Not found" };
    if (kind !== "FREE" && kind !== "LOCKED") return { error: "Choose free or locked." };
    const name = roomName.trim().slice(0, 20);
    if (!name) return { error: "Name the room." };
    const headerList = await headers();
    const ip = clientIpFrom((headerName) => headerList.get(headerName));
    await assertIpLimit(`report:${inst.id}:${ip}`, 10, 60 * 60 * 1000);
    await recordAttempt(`report:${inst.id}:${ip}`);
    await prisma.crowdReport.create({
      data: {
        institutionId: inst.id,
        roomKey: roomKey(name),
        roomName: name,
        kind,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return { ok: true };
  } catch (error) {
    return { error: error instanceof HttpError ? error.message : "Could not save that report." };
  }
}
