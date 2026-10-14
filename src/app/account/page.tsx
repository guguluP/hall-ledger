import { redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { deleteAccountAction, logoutEverywhereAction, passwordAction, resendAction } from "@/lib/actions/auth";
import { listSessions } from "@/lib/auth/service";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const shell = await shellData();
  if (!shell.current) redirect("/login?next=/account");
  const sessions = await listSessions(shell.current.id);
  return (
    <AppShell title="Account" subtitle={shell.current.email} user={shell.user} institutions={shell.institutions}>
      {!shell.current.emailVerifiedAt && (
        <form action={resendAction} className="mb-6 rounded-2xl border border-border bg-surface p-4">
          <p className="text-[14px]">Verify your email before you create an institution or publish.</p>
          {sent && <p className="mt-2 text-[13px] text-ok">Verification link sent.</p>}
          <button className="mt-3 text-[13px] font-medium text-accent" type="submit">Resend link</button>
        </form>
      )}
      <section className="mb-8 max-w-md">
        <h2 className="mb-3 text-[17px] font-semibold">Change password</h2>
        <FormCard action={passwordAction} submit="Update password">
          <input className={fieldClass} name="current" type="password" required placeholder="Current password" autoComplete="current-password" />
          <input className={fieldClass} name="next" type="password" required minLength={10} placeholder="New password" autoComplete="new-password" />
        </FormCard>
      </section>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Sessions</h2>
          <form action={logoutEverywhereAction}>
            <button className="text-[13px] font-medium text-accent" type="submit">Log out everywhere</button>
          </form>
        </div>
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] text-muted">
              <span className="text-fg">{session.ip || "Unknown IP"}</span>
              {" · "}
              {session.userAgent?.slice(0, 80) || "Unknown device"}
              <span className="block">Last seen {session.lastSeenAt.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="max-w-md">
        <h2 className="mb-3 text-[17px] font-semibold">Delete account</h2>
        <FormCard action={deleteAccountAction} submit="Delete account">
          <input className={fieldClass} name="confirm" placeholder="Type DELETE" />
        </FormCard>
      </section>
    </AppShell>
  );
}
