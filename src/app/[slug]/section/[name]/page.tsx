import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { visibleInstitution } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";
import { shellData } from "@/lib/shell";
import { labelTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SectionPage({ params }: { params: Promise<{ slug: string; name: string }> }) {
  const { slug, name } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const [published, shell] = await Promise.all([getPublished(inst.id), shellData()]);
  const section = decodeURIComponent(name);
  const slots = published.slots.filter((slot) => slot.sectionName?.toLowerCase() === section.toLowerCase());
  if (!slots.length) notFound();
  return (
    <AppShell title={section} subtitle={inst.name} slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <ul className="space-y-2">
        {slots
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin)
          .map((slot) => (
            <li key={`${slot.dayOfWeek}-${slot.startMin}-${slot.classroomName}-${slot.subjectName}`} className="rounded-2xl border border-border bg-surface px-4 py-3">
              <p className="text-[14px] font-semibold">{DAYS[slot.dayOfWeek]} · {labelTime(slot.startTime)}–{labelTime(slot.endTime)}</p>
              <p className="text-[13px] text-muted">{slot.subjectName || "Class"} · {slot.classroomName || "Room not listed"}</p>
            </li>
          ))}
      </ul>
    </AppShell>
  );
}
