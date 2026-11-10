import { fieldClass } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { changeAction, deleteChangeAction } from "@/lib/actions/campus";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [changes, shell] = await Promise.all([
    prisma.scheduleChange.findMany({ where: { institutionId: inst.id }, orderBy: { date: "asc" } }),
    shellData(),
  ]);
  const canEdit = isRole(role) && RANK[role] >= RANK.EDITOR;
  return (
    <AppShell title="Changes" subtitle="A cancellation, swap, or event sits on top of the weekly timetable for one date." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <ul className="mb-8 space-y-2">
        {changes.map((change) => (
          <li key={change.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="font-semibold">{change.kind} · {change.date}</p>
              <p className="text-[12px] text-muted">{change.section || "Any section"} · {change.roomName || change.fromRoom || "Room"} · {fromMinutes(change.startMin)}–{fromMinutes(change.endMin)}</p>
            </div>
            {canEdit && (
              <form action={deleteChangeAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={change.id} />
                <button className="text-[13px] text-danger" type="submit">Remove</button>
              </form>
            )}
          </li>
        ))}
        {changes.length === 0 && <li className="text-[14px] text-muted">No one-off changes.</li>}
      </ul>
      {canEdit && (
        <form action={changeAction} className="grid max-w-xl gap-3 sm:grid-cols-2">
          <input type="hidden" name="slug" value={slug} />
          <select name="kind" className={fieldClass} defaultValue="CANCEL">
            <option value="CANCEL">Cancel</option>
            <option value="SWAP">Swap room</option>
            <option value="EVENT">Event</option>
          </select>
          <input className={fieldClass} type="date" name="date" required />
          <input className={fieldClass} name="section" placeholder="Section" />
          <input className={fieldClass} name="subject" placeholder="Subject" />
          <input className={fieldClass} name="teacher" placeholder="Teacher" />
          <input className={fieldClass} name="fromRoom" placeholder="From room" />
          <input className={fieldClass} name="room" placeholder="Room" />
          <input className={fieldClass} type="time" name="start" required />
          <input className={fieldClass} type="time" name="end" required />
          <input className={`${fieldClass} sm:col-span-2`} name="note" placeholder="Note" />
          <button className="h-11 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-fg sm:col-span-2" type="submit">Save change</button>
        </form>
      )}
    </AppShell>
  );
}
