import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { fieldClass, FormCard } from "@/components/form-card";
import { loginAction } from "@/lib/actions/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/account" } = await searchParams;
  return (
    <AuthFrame title="Log in" subtitle="Use the email and password for your Hall Ledger account.">
      <FormCard action={loginAction} submit="Log in">
        <input type="hidden" name="next" value={next} />
        <input className={fieldClass} name="email" type="email" required placeholder="Email" autoComplete="email" />
        <input className={fieldClass} name="password" type="password" required placeholder="Password" autoComplete="current-password" />
      </FormCard>
      <p className="mt-4 text-[13px] text-muted">
        <Link href="/forgot" className="underline">Forgot password</Link>
        {" · "}
        <Link href="/signup" className="underline">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
