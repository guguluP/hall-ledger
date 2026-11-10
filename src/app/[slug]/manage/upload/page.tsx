import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { fieldClass } from "@/components/form-card";
import { UploadForm } from "@/components/upload-form";
import { sheetImportAction } from "@/lib/actions/campus";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  try {
    const { inst } = await requireRole(slug, "EDITOR");
    const shell = await shellData();
    return (
      <AppShell title="Upload" subtitle="Review the draft, then publish. The file itself is not stored." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
        <UploadForm slug={slug} />
        <form action={sheetImportAction} className="mt-8 max-w-xl space-y-3">
          <h2 className="text-[17px] font-semibold">Google Sheets</h2>
          <p className="text-[13px] text-muted">Paste a docs.google.com link. The sheet must be visible to anyone with the link. The download stays on Google.</p>
          <input type="hidden" name="slug" value={slug} />
          <input className={fieldClass} name="url" type="url" required placeholder="https://docs.google.com/spreadsheets/d/…" />
          <button className="h-11 rounded-full bg-accent px-5 text-[14px] font-medium text-accent-fg" type="submit">Import sheet</button>
        </form>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/upload`);
    if (error instanceof HttpError) notFound();
    throw error;
  }
}
