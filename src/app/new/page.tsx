import { redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { createInstitutionAction } from "@/lib/actions/institution";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function NewInstitutionPage() {
  const shell = await shellData();
  if (!shell.current) redirect("/login?next=/new");
  return (
    <AppShell title="New institution" subtitle="A verified email is required. You become the owner." user={shell.user} institutions={shell.institutions}>
      {!shell.current.emailVerifiedAt && <p className="mb-4 text-[14px] text-danger">Verify your email on the account page first.</p>}
      <div className="max-w-md">
        <FormCard action={createInstitutionAction} submit="Create">
          <input className={fieldClass} name="name" required placeholder="School name" maxLength={80} />
          <input className={fieldClass} name="slug" required placeholder="short-name" pattern="[a-z0-9-]{3,40}" />
        </FormCard>
      </div>
    </AppShell>
  );
}
