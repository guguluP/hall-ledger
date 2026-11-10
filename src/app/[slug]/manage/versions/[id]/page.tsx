import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth/authz";
import { isRole, RANK } from "@/lib/auth/roles";
import { detectClashes, detectHardConflicts, labelMinutes, type SlotIn } from "@/lib/parse/timetable";
import { diffSlots } from "@/lib/preview";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";
import { suggestReplacements } from "@/lib/suggest";
import { PublishButton } from "../publish-button";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toSlot(slot: {
  section: string;
  subject: string | null;
  roomName: string | null;
  teacher: string | null;
  type: string;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}): SlotIn {
  return {
    section: slot.section,
    subject: slot.subject,
    room: slot.roomName,
    teacher: slot.teacher,
    type: slot.type,
    dayOfWeek: slot.dayOfWeek,
    startMin: slot.startMin,
    endMin: slot.endMin,
  };
}

export default async function PreviewPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { inst, role } = await requireRole(slug, "VIEWER");
  const version = await prisma.timetableVersion.findFirst({
    where: { id, timetable: { institutionId: inst.id } },
    include: { slots: true, timetable: true },
  });
  if (!version) notFound();
  const live = version.timetable.activeVersionId
    ? await prisma.slot.findMany({ where: { versionId: version.timetable.activeVersionId } })
    : [];
  const draft = version.slots.map(toSlot);
  const current = live.map(toSlot);
  const changes = diffSlots(current, draft);
  const conflicts = detectHardConflicts(draft);
  const clashes = detectClashes(draft);
  const rooms = await prisma.room.findMany({ where: { institutionId: inst.id } });
  const strengths = await prisma.sectionStrength.findMany({ where: { institutionId: inst.id } });
  const suggestions = suggestReplacements(conflicts, rooms, draft, strengths);
  const warnings = Array.isArray(version.warnings) ? version.warnings.filter((item) => typeof item === "string") : [];
  const shell = await shellData();
  const canPublish = isRole(role) && RANK[role] >= RANK.EDITOR && version.status !== "PUBLISHED";
  return (
    <AppShell title="Preview" subtitle="Compare this draft with the live timetable before it replaces what students see." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <p className="mb-4 text-[14px] text-muted">{changes.length} differences · {conflicts.length} room overlaps · {clashes.length} other clashes</p>
      <ul className="mb-6 space-y-2">
        {changes.slice(0, 40).map((change) => (
          <li key={`${change.kind}-${change.section}-${change.day}-${change.startMin}`} className="rounded-2xl border border-border bg-surface px-4 py-3 text-[14px]">
            <p className="font-semibold">{change.kind} · {change.section} · {DAYS[change.day]} {labelMinutes(change.startMin)}–{labelMinutes(change.endMin)}</p>
            {change.before && <p className="text-muted">Was {change.before}</p>}
            {change.after && <p className="text-muted">Now {change.after}</p>}
          </li>
        ))}
        {changes.length === 0 && <li className="text-[14px] text-muted">This draft matches the live timetable.</li>}
      </ul>
      {warnings.length > 0 && (
        <ul className="mb-6 space-y-1 text-[13px] text-muted">
          {warnings.slice(0, 20).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}
      {suggestions.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-[17px] font-semibold">Nearest free room</h2>
          {suggestions.map((item) => (
            <p key={`${item.conflict.room}-${item.conflict.time}`} className="text-[14px] text-muted">
              {item.conflict.room} on {item.conflict.day} {item.conflict.time}: {item.suggestions.length ? item.suggestions.map((room) => room.name).join(", ") : "no room with enough seats is free"}
            </p>
          ))}
        </section>
      )}
      {clashes.slice(0, 12).map((clash) => (
        <p key={`${clash.type}-${clash.time}-${clash.sections.join()}`} className="mb-2 text-[14px] text-muted">
          {clash.type === "TEACHER_OVERLAP" ? `${clash.teacher} is in two places` : `${clash.sections[0]} is in two rooms`} · {clash.day} {clash.time}
        </p>
      ))}
      <div className="mt-6 flex items-center gap-3">
        {canPublish && <PublishButton slug={slug} id={version.id} />}
        <Link href={`/${slug}/manage/versions`} className="text-[14px] text-muted">Back</Link>
      </div>
    </AppShell>
  );
}
