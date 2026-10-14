import { fieldClass, FormCard } from "@/components/form-card";
import { resetAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <AuthFrame title="Choose a new password" subtitle="Confirming here uses the link once. Opening the email does not reset the password.">
      <FormCard action={resetAction} submit="Update password">
        <input type="hidden" name="token" value={token} />
        <input className={fieldClass} name="password" type="password" required minLength={10} placeholder="New password" autoComplete="new-password" />
      </FormCard>
    </AuthFrame>
  );
}
