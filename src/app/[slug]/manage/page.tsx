import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { alertAction } from "@/lib/actions/campus";
import { requireRole } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user, inst, role } = await requireRole(slug, "VIEWER");
  const [published, shell, pref] = await Promise.all([
    getPublished(inst.id),
    shellData(),
    prisma.alertPreference.findUnique({ where: { institutionId_userId: { institutionId: inst.id, userId: user.id } } }),
  ]);
  const links = [
    ["/manage/upload", "Upload a CSV"],
    ["/manage/versions", "Versions and rollback"],
    ["/manage/rooms", "Rooms"],
    ["/manage/members", "Members and invites"],
    ["/manage/students", "Section counts"],
    ["/manage/calendar", "Holidays and hours"],
    ["/manage/changes", "Cancellations and swaps"],
    ["/manage/bookings", "Room requests"],
    ["/manage/usage", "Utilisation"],
    ["/manage/settings", "Settings"],
  ];
  return (
    <AppShell title="Manage" subtitle={`${inst.name} · ${role}`} slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <p className="mb-6 text-[14px] text-muted">{published.stats.slots} published slots · {published.stats.conflicts} room overlaps</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map(([href, label]) => (
          <Link key={href} href={`/${slug}${href}`} className="rounded-2xl border border-border bg-surface px-4 py-4 text-[15px] font-medium">
            {label}
          </Link>
        ))}
      </div>
      <form action={alertAction} className="mt-8 max-w-md space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <label className="flex items-center gap-2 text-[14px]">
          <input name="email" type="checkbox" defaultChecked={pref?.email !== false} /> Email me when the timetable changes
        </label>
        <p className="text-[12px] text-muted">Push and WhatsApp are not sent. Mail uses the address on your account.</p>
        <button className="h-10 rounded-full bg-elevated px-4 text-[13px] font-medium" type="submit">Save alerts</button>
      </form>
    </AppShell>
  );
}
