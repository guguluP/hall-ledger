import { notFound } from "next/navigation";
import { visibleInstitution } from "@/lib/auth/authz";
import { findAvailability } from "@/lib/occupancy";
import { getPublished } from "@/lib/published";
import { prisma } from "@/lib/prisma";
import { applyDatedChanges, campusNote, istNow } from "@/lib/schedule";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const now = istNow();
  const published = await getPublished(inst.id);
  const closures = await prisma.closure.findMany({ where: { institutionId: inst.id } });
  const note = campusNote({ day: now.day, date: now.date, sundayOpen: inst.sundayOpen, closures });
  const changes = await prisma.scheduleChange.findMany({ where: { institutionId: inst.id, date: now.date } });
  const bookings = await prisma.bookingRequest.findMany({ where: { institutionId: inst.id, date: now.date, status: "APPROVED" } });
  const slots = applyDatedChanges(published.slots, now.day, changes, bookings, { pauseWeekly: note.exam });
  const start = Math.min(Math.max(now.minutes, inst.dayStartMin), Math.max(inst.dayStartMin, inst.dayEndMin - 1));
  const result = note.closed || now.minutes >= inst.dayEndMin
    ? { free: [] }
    : findAvailability(published.rooms, slots, now.day, fromMinutes(start), fromMinutes(inst.dayEndMin));
  return (
    <main className="min-h-screen bg-bg p-4 text-fg">
      <p className="text-[13px] text-muted">{inst.name} · free now</p>
      {note.closed || now.minutes >= inst.dayEndMin ? (
        <p className="mt-3 text-[15px]">{note.reason || "The building is closed, so no room is free to use."}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {result.free.slice(0, 8).map((room) => (
            <li key={room.name} className="rounded-2xl border border-border bg-surface px-3 py-2 text-[14px]">
              {room.name} · free for {Math.max(0, room.freeUntilMin - start)} min
            </li>
          ))}
          {result.free.length === 0 && <li className="text-[14px] text-muted">No hall is free right now.</li>}
        </ul>
      )}
    </main>
  );
}
