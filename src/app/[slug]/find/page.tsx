import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FindRooms } from "@/components/find-rooms";
import { visibleInstitution } from "@/lib/auth/authz";
import { istNow } from "@/lib/schedule";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const shell = await shellData();
  const now = istNow();
  return (
    <AppShell title="Find a room" subtitle="Free now uses India Standard Time and refreshes every minute." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <FindRooms slug={slug} today={now.day} date={now.date} />
    </AppShell>
  );
}
