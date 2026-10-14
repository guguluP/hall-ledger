import { notFound, redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { settingsAction } from "@/lib/actions/institution";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const { inst } = await requireRole(slug, "OWNER");
    const shell = await shellData();
    return (
      <AppShell title="Settings" subtitle="Owners can rename the school and choose who can see the timetable." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        <div className="max-w-md">
          <FormCard action={settingsAction} submit="Save">
            <input type="hidden" name="slug" value={slug} />
            <input className={fieldClass} name="name" defaultValue={inst.name} required />
            <input className={fieldClass} name="nextSlug" defaultValue={inst.slug} required pattern="[a-z0-9-]{3,40}" />
            <label className="flex items-center gap-2 text-[14px]">
              <input name="isPublic" type="checkbox" defaultChecked={inst.isPublic} /> Public timetable
            </label>
          </FormCard>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/settings`);
    notFound();
  }
}
