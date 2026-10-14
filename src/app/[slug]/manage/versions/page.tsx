import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { listVersions } from "@/lib/timetable-repo";
import { shellData } from "@/lib/shell";
import { PublishButton } from "./publish-button";

export const dynamic = "force-dynamic";

export default async function VersionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const [versions, shell] = await Promise.all([listVersions(inst.id), shellData()]);
  const canPublish = isRole(role) && RANK[role] >= RANK.EDITOR;
  return (
    <AppShell title="Versions" subtitle="Publishing archives the previous live version. Publish an older one to roll back." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <ul className="space-y-2">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[14px] font-semibold">{version.fileName || "Untitled"} · {version.status}{version.active ? " · live" : ""}</p>
              <p className="text-[12px] text-muted">{version.conflictCount} conflicts · {new Date(version.createdAt).toLocaleString()}</p>
            </div>
            {canPublish && version.status !== "PUBLISHED" && <PublishButton slug={slug} id={version.id} />}
          </li>
        ))}
        {versions.length === 0 && <li className="text-[14px] text-muted">No drafts yet.</li>}
      </ul>
    </AppShell>
  );
}
