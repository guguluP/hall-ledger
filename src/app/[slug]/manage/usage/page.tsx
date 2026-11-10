import Link from "next/link";
import { fieldClass } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { observationAction } from "@/lib/actions/campus";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { getPublished } from "@/lib/published";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";
import { labelTime } from "@/lib/time";
import { weeklyUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default async function UsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [published, notes, shell] = await Promise.all([
    getPublished(inst.id),
    prisma.occupancyNote.findMany({ where: { institutionId: inst.id }, orderBy: { observedAt: "desc" }, take: 12 }),
    shellData(),
  ]);
  const usage = weeklyUsage(published.rooms, published.slots, inst.dayStartMin, inst.dayEndMin, inst.sundayOpen);
  const canRecord = isRole(role) && RANK[role] >= RANK.ADMIN;
  const peak = usage.peak.count
    ? `Busiest point: ${usage.peak.day} ${labelTime(usage.peak.minute)}, ${usage.peak.count} rooms in use.`
    : "No classes are scheduled in building hours.";
  return (
    <AppShell title="Utilisation" subtitle="Weekly room use for an IQAC or NAAC working sheet. Hours are merged when two classes overlap." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <p className="mb-4 text-[14px] text-muted">{peak}</p>
      <p className="mb-6 text-[14px]"><Link className="text-accent" href={`/api/i/${inst.slug}/usage`}>Download CSV</Link></p>
      <div className="mb-8 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-3 py-2">Room</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Seats</th>
              <th className="px-3 py-2">ICT</th>
              <th className="px-3 py-2">Hours</th>
              <th className="px-3 py-2">Use</th>
            </tr>
          </thead>
          <tbody>
            {usage.rows.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2">{row.type}</td>
                <td className="px-3 py-2">{row.capacity || "—"}</td>
                <td className="px-3 py-2">{[row.projector === "Yes" ? "Projector" : "", row.smartBoard === "Yes" ? "Board" : "", row.ac === "Yes" ? "AC" : ""].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{row.scheduledHours}/{row.availableHours}</td>
                <td className="px-3 py-2 tabular-nums">{row.utilisation}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-8 overflow-x-auto">
        <table className="text-[12px]">
          <tbody>
            {usage.heatmap.map((row) => (
              <tr key={row.day}>
                <th className="pr-3 text-left text-muted">{row.label}</th>
                {row.cells.map((cell) => (
                  <td key={cell.minute} title={`${row.label} ${labelTime(cell.minute)}: ${cell.count}`} className="h-8 w-8 text-center" style={{ background: `rgba(10,132,255,${Math.min(0.85, cell.count / Math.max(1, published.rooms.length))})` }}>
                    {cell.count || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mb-8">
        <h2 className="mb-3 text-[17px] font-semibold">Observed use</h2>
        <ul className="mb-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="text-[14px] text-muted">{note.roomName} · {note.occupied ? "occupied" : "empty"}{note.headcount != null ? ` · ${note.headcount} people` : ""} · {note.source}</li>
          ))}
          {notes.length === 0 && <li className="text-[14px] text-muted">No observations yet. An admin can record what a room check or sensor saw.</li>}
        </ul>
        {canRecord && (
          <form action={observationAction} className="grid max-w-xl gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <input className={fieldClass} name="room" required placeholder="Room" />
            <input className={fieldClass} name="headcount" inputMode="numeric" placeholder="People counted" />
            <label className="flex items-center gap-2 text-[14px]"><input name="occupied" type="checkbox" /> Occupied</label>
            <button className="h-11 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-fg" type="submit">Record</button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
