import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { studentsAction } from "@/lib/actions/institution";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { prisma } from "@/lib/prisma";
import { proposeMerges } from "@/lib/students";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const [rows, shell] = await Promise.all([
      prisma.sectionStrength.findMany({ where: { institutionId: inst.id }, orderBy: { section: "asc" } }),
      shellData(),
    ]);
    const proposals = proposeMerges(rows.map((row) => ({ section: row.section, students: row.students })));
    return (
      <AppShell title="Students" subtitle="Only section counts are stored. Names and roll numbers are discarded." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        <p className="mb-4 text-[14px] text-muted">
          CSV with a Section column, plus either a count or one row per student. <a className="underline" href="/samples/students-template.csv">Template</a>
        </p>
        <div className="mb-8 max-w-md">
          <FormCard action={studentsAction} submit="Save counts">
            <input type="hidden" name="slug" value={slug} />
            <input name="file" type="file" accept=".csv,.tsv,text/csv" required className="text-[14px]" />
          </FormCard>
        </div>
        <ul className="mb-8 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
              <Link href={`/${slug}/section/${encodeURIComponent(row.section)}`} className="font-semibold">{row.section}</Link>
              <p className="text-[13px] text-muted">{row.students} students</p>
            </li>
          ))}
        </ul>
        {proposals.length > 0 && (
          <section>
            <h2 className="mb-3 text-[17px] font-semibold">Consolidation</h2>
            <ul className="space-y-2">
              {proposals.map((proposal) => (
                <li key={proposal.from} className="rounded-2xl border border-border bg-surface px-4 py-3 text-[14px]">
                  {proposal.reason} Combined size {proposal.combined}.
                </li>
              ))}
            </ul>
          </section>
        )}
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/students`);
    notFound();
  }
}
