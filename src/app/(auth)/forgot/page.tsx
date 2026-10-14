import { fieldClass, FormCard } from "@/components/form-card";
import { forgotAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";

export default function ForgotPage() {
  return (
    <AuthFrame title="Reset password" subtitle="If that email exists, we send a link. The link expires in one hour.">
      <FormCard action={forgotAction} submit="Send link">
        <input className={fieldClass} name="email" type="email" required placeholder="Email" autoComplete="email" />
      </FormCard>
    </AuthFrame>
  );
}
