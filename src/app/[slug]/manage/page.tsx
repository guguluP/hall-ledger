import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [published, shell] = await Promise.all([getPublished(inst.id), shellData()]);
  const links = [
    ["/manage/upload", "Upload a CSV"],
    ["/manage/versions", "Versions and rollback"],
    ["/manage/rooms", "Rooms"],
    ["/manage/members", "Members and invites"],
    ["/manage/students", "Section counts"],
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
    </AppShell>
  );
}
