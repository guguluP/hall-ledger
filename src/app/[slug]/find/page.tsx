import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FindRooms } from "@/components/find-rooms";
import { visibleInstitution } from "@/lib/auth/authz";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function FindPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const shell = await shellData();
  return (
    <AppShell title="Find a room" subtitle="A hall is free only for the whole window." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
      <FindRooms slug={slug} />
    </AppShell>
  );
}
