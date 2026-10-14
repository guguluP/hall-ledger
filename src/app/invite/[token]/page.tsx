import { redirect } from "next/navigation";
import { FormCard } from "@/components/form-card";
import { acceptInviteAction } from "@/lib/actions/institution";
import { AuthFrame } from "@/components/auth-frame";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/invite/${token}`);
  return (
    <AuthFrame title="Accept invite" subtitle={`Signed in as ${user.email}. The invite only works for that address.`}>
      <FormCard action={acceptInviteAction} submit="Accept invite">
        <input type="hidden" name="token" value={token} />
      </FormCard>
    </AuthFrame>
  );
}
