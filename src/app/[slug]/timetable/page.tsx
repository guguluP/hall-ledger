import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimetableGrid } from "@/components/timetable-grid";
import { membershipFor, visibleInstitution } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function TimetablePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const shell = await shellData();
  const member = shell.current ? await membershipFor(shell.current.id, inst.id) : null;
  const canUpload = Boolean(member && isRole(member.role) && RANK[member.role] >= RANK.EDITOR);
  return (
    <AppShell title="Timetable" subtitle={inst.name} slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <TimetableGrid slug={slug} canUpload={canUpload} />
    </AppShell>
  );
}
