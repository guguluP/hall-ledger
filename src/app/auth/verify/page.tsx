import { FormCard } from "@/components/form-card";
import { verifyAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <AuthFrame title="Verify email" subtitle="Confirm to activate publishing and new institutions. The link is used once.">
      <FormCard action={verifyAction} submit="Verify email">
        <input type="hidden" name="token" value={token} />
      </FormCard>
    </AuthFrame>
  );
}
