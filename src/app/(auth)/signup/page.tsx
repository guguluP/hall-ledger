import Link from "next/link";
import { fieldClass, FormCard } from "@/components/form-card";
import { signupAction } from "@/lib/actions/auth";
import { AuthFrame } from "@/components/auth-frame";

export default function SignupPage() {
  return (
    <AuthFrame title="Create an account" subtitle="At least 10 characters. You can log in before the email is verified, but publishing waits.">
      <FormCard action={signupAction} submit="Sign up">
        <input className={fieldClass} name="name" placeholder="Name" autoComplete="name" maxLength={80} />
        <input className={fieldClass} name="email" type="email" required placeholder="Email" autoComplete="email" />
        <input className={fieldClass} name="password" type="password" required minLength={10} placeholder="Password" autoComplete="new-password" />
      </FormCard>
      <p className="mt-4 text-[13px] text-muted"><Link href="/login" className="underline">Already have an account</Link></p>
    </AuthFrame>
  );
}
