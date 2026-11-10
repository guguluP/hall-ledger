import { fieldClass } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { bookingAction, bookingDecisionAction } from "@/lib/actions/campus";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [bookings, shell] = await Promise.all([
    prisma.bookingRequest.findMany({ where: { institutionId: inst.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    shellData(),
  ]);
  const canDecide = isRole(role) && RANK[role] >= RANK.ADMIN;
  return (
    <AppShell title="Requests" subtitle="A member asks for a room. An admin approves it before it blocks vacancy." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <ul className="mb-8 space-y-2">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="font-semibold">{booking.roomName} · {booking.status}</p>
            <p className="text-[13px] text-muted">{booking.date} · {fromMinutes(booking.startMin)}–{fromMinutes(booking.endMin)} · {booking.purpose}</p>
            {canDecide && booking.status === "PENDING" && (
              <div className="mt-2 flex gap-2">
                <form action={bookingDecisionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="APPROVED" />
                  <button className="text-[13px] font-medium text-accent" type="submit">Approve</button>
                </form>
                <form action={bookingDecisionAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <button className="text-[13px] text-danger" type="submit">Reject</button>
                </form>
              </div>
            )}
          </li>
        ))}
        {bookings.length === 0 && <li className="text-[14px] text-muted">No requests yet.</li>}
      </ul>
      <form action={bookingAction} className="grid max-w-xl gap-3 sm:grid-cols-2">
        <input type="hidden" name="slug" value={slug} />
        <input className={fieldClass} name="room" required placeholder="Room" />
        <input className={fieldClass} type="date" name="date" required />
        <input className={fieldClass} type="time" name="start" required />
        <input className={fieldClass} type="time" name="end" required />
        <input className={`${fieldClass} sm:col-span-2`} name="purpose" required placeholder="What is the room for?" />
        <button className="h-11 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-fg sm:col-span-2" type="submit">Request room</button>
      </form>
    </AppShell>
  );
}
