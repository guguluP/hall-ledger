import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UploadForm } from "@/components/upload-form";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { inst } = await requireRole(slug, "EDITOR");
    const shell = await shellData();
    return (
      <AppShell title="Upload" subtitle="Review the draft, then publish. The file itself is not stored." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        <UploadForm slug={slug} />
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/upload`);
    if (error instanceof HttpError) notFound();
    throw error;
  }
}
