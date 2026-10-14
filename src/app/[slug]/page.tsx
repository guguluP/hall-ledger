import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AppShell } from "@/components/app-shell";
import { visibleInstitution } from "@/lib/auth/authz";
import { appUrl } from "@/lib/auth/csrf";
import { membershipFor } from "@/lib/auth/authz";
import { getPublished } from "@/lib/published";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function InstitutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inst = await visibleInstitution(slug);
  if (!inst) notFound();
  const [published, shell] = await Promise.all([getPublished(inst.id), shellData()]);
  const member = shell.current ? await membershipFor(shell.current.id, inst.id) : null;
  const share = `${appUrl()}/${inst.slug}`;
  const qr = await QRCode.toDataURL(share, { margin: 1, width: 168 });
  return (
    <AppShell
      title={inst.name}
      subtitle={inst.isPublic ? "Public timetable" : "Members only"}
      slug={inst.slug}
      institutionName={inst.name}
      user={shell.user}
      institutions={shell.institutions}
    >
      <div className="mb-8 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Rooms" value={published.stats.rooms} />
        <Stat label="Sections" value={published.stats.sections} />
        <Stat label="Slots" value={published.stats.slots} />
        <Stat label="Conflicts" value={published.stats.conflicts} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link href={`/${slug}/find`} className="rounded-[28px] border border-border bg-surface px-4 py-4">Find a free room</Link>
        <Link href={`/${slug}/timetable`} className="rounded-[28px] border border-border bg-surface px-4 py-4">Open the grid</Link>
        {member ? <Link href={`/${slug}/manage`} className="rounded-[28px] border border-border bg-surface px-4 py-4">Manage · {member.role}</Link> : <span />}
      </div>
      <section className="flex flex-col items-start gap-4 rounded-[28px] border border-border bg-surface p-5 sm:flex-row sm:items-center">
        <Image src={qr} alt={`QR code for ${inst.name}`} width={168} height={168} unoptimized className="rounded-xl bg-white p-2" />
        <div>
          <h2 className="text-[17px] font-semibold">Share</h2>
          <p className="mt-1 break-all text-[14px] text-muted">{share}</p>
          {published.fileName && <p className="mt-2 text-[13px] text-subtle">{published.fileName}</p>}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[28px] border border-border bg-surface px-4 py-3.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-semibold tabular-nums leading-none">{value}</p>
    </div>
  );
}
