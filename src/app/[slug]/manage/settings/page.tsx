import { notFound, redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { settingsAction } from "@/lib/actions/institution";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { fromMinutes } from "@/lib/time";
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
          <p className="mb-4 text-[14px] text-muted">Changing the address keeps the old one. Printed QR codes and old links redirect to the new address.</p>
          <FormCard action={settingsAction} submit="Save">
            <input type="hidden" name="slug" value={slug} />
            <input className={fieldClass} name="name" defaultValue={inst.name} required />
            <input className={fieldClass} name="nextSlug" defaultValue={inst.slug} required pattern="[a-z0-9-]{3,40}" />
            <label className="block text-[13px] text-muted">Opens
              <input className={`${fieldClass} mt-1`} type="time" name="dayStart" defaultValue={fromMinutes(inst.dayStartMin)} />
            </label>
            <label className="block text-[13px] text-muted">Closes
              <input className={`${fieldClass} mt-1`} type="time" name="dayEnd" defaultValue={fromMinutes(inst.dayEndMin)} />
            </label>
            <label className="flex items-center gap-2 text-[14px]">
              <input name="sundayOpen" type="checkbox" defaultChecked={inst.sundayOpen} /> Sunday classes run
            </label>
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
