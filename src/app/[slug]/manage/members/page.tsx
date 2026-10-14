import { notFound, redirect } from "next/navigation";
import { fieldClass, FormCard } from "@/components/form-card";
import { AppShell } from "@/components/app-shell";
import { inviteAction, removeMemberAction, roleAction } from "@/lib/actions/institution";
import { HttpError } from "@/lib/http-error";
import { requireRole } from "@/lib/auth/authz";
import { ROLES } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { slug } = await params;
  const { sent } = await searchParams;
  try {
    const { inst } = await requireRole(slug, "ADMIN");
    const [members, shell] = await Promise.all([
      prisma.membership.findMany({
        where: { institutionId: inst.id },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      shellData(),
    ]);
    return (
      <AppShell title="Members" subtitle="The last owner cannot be removed or demoted." slug={slug} institutionName={inst.name} user={shell.user} institutions={shell.institutions}>
        {sent && <p className="mb-4 text-[14px] text-ok">Invite sent.</p>}
        <ul className="mb-8 space-y-3">
          {members.map((member) => (
            <li key={member.userId} className="rounded-2xl border border-border bg-surface px-4 py-3">
              <p className="font-semibold">{member.user.name || member.user.email}</p>
              <p className="text-[12px] text-muted">{member.user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <form action={roleAction} className="flex gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <select name="role" defaultValue={member.role} className={fieldClass}>
                    {ROLES.map((role) => <option key={role}>{role}</option>)}
                  </select>
                  <button className="text-[13px] font-medium text-accent" type="submit">Save role</button>
                </form>
                <form action={removeMemberAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button className="text-[13px] text-danger" type="submit">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <div className="max-w-md">
          <h2 className="mb-3 text-[17px] font-semibold">Invite</h2>
          <FormCard action={inviteAction} submit="Send invite">
            <input type="hidden" name="slug" value={slug} />
            <input className={fieldClass} name="email" type="email" required placeholder="Email" />
            <select name="role" className={fieldClass} defaultValue="EDITOR">
              <option>VIEWER</option>
              <option>EDITOR</option>
              <option>ADMIN</option>
            </select>
          </FormCard>
        </div>
      </AppShell>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect(`/login?next=/${slug}/manage/members`);
    notFound();
  }
}
