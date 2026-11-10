import { fieldClass } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { closureAction, deleteClosureAction } from "@/lib/actions/campus";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";
import { fromMinutes } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [closures, shell] = await Promise.all([
    prisma.closure.findMany({ where: { institutionId: inst.id }, orderBy: { startDate: "asc" } }),
    shellData(),
  ]);
  const canEdit = isRole(role) && RANK[role] >= RANK.EDITOR;
  return (
    <AppShell title="Calendar" subtitle={`${fromMinutes(inst.dayStartMin)}–${fromMinutes(inst.dayEndMin)} · ${inst.sundayOpen ? "Sunday is open" : "Sunday is closed"}`} slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <ul className="mb-8 space-y-2">
        {closures.map((closure) => (
          <li key={closure.id} className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="font-semibold">{closure.label}</p>
              <p className="text-[12px] text-muted">{closure.kind} · {closure.startDate} to {closure.endDate}</p>
            </div>
            {canEdit && (
              <form action={deleteClosureAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={closure.id} />
                <button className="text-[13px] text-danger" type="submit">Remove</button>
              </form>
            )}
          </li>
        ))}
        {closures.length === 0 && <li className="text-[14px] text-muted">No holidays or exam weeks yet.</li>}
      </ul>
      {canEdit && (
        <form action={closureAction} className="max-w-md space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <input className={fieldClass} name="label" required placeholder="Holiday name" />
          <select name="kind" className={fieldClass} defaultValue="HOLIDAY">
            <option value="HOLIDAY">Holiday</option>
            <option value="CLOSED">Closed</option>
            <option value="EXAM">Exam week</option>
          </select>
          <input className={fieldClass} type="date" name="startDate" required />
          <input className={fieldClass} type="date" name="endDate" required />
          <button className="h-11 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-fg" type="submit">Add dates</button>
        </form>
      )}
    </AppShell>
  );
}
