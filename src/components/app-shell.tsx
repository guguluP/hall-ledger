"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, DoorOpen, LayoutDashboard, LogOut, Settings, Upload, Users, History, Building2 } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export type ShellInstitution = { slug: string; name: string; role: string };
export type ShellUser = { email: string; name: string | null; verified: boolean } | null;

const field =
  "h-9 rounded-full border border-border bg-elevated px-3 text-[13px] text-fg outline-none";

export function AppShell({
  children,
  title,
  subtitle,
  slug,
  institutionName,
  user,
  institutions = [],
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  slug?: string;
  institutionName?: string;
  user?: ShellUser;
  institutions?: ShellInstitution[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const manage = Boolean(slug && pathname.includes(`/${slug}/manage`));
  const items = slug
    ? manage
      ? [
          { href: `/${slug}/manage`, label: "Home", icon: LayoutDashboard },
          { href: `/${slug}/manage/upload`, label: "Upload", icon: Upload },
          { href: `/${slug}/manage/versions`, label: "Versions", icon: History },
          { href: `/${slug}/manage/rooms`, label: "Rooms", icon: Building2 },
          { href: `/${slug}/manage/members`, label: "Members", icon: Users },
          { href: `/${slug}/manage/students`, label: "Students", icon: Users },
          { href: `/${slug}/manage/settings`, label: "Settings", icon: Settings },
        ]
      : [
          { href: `/${slug}`, label: "Home", icon: LayoutDashboard },
          { href: `/${slug}/find`, label: "Find", icon: DoorOpen },
          { href: `/${slug}/timetable`, label: "Grid", icon: Calendar },
          { href: `/${slug}/manage`, label: "Manage", icon: Settings },
        ]
    : [];

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border glass-strong">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={slug ? `/${slug}` : "/"} className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-fg shadow-sm">
              <DoorOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span className="truncate text-[15px] font-semibold tracking-tight">
              {institutionName || "Hall Ledger"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {institutions.length > 0 && (
              <select
                className={field}
                aria-label="Switch institution"
                value={slug || ""}
                onChange={(event) => {
                  if (event.target.value) router.push(`/${event.target.value}`);
                }}
              >
                {!slug && <option value="">Institutions</option>}
                {institutions.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            )}
            {user ? (
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-full bg-elevated px-3 py-1.5 text-[13px] font-medium">
                  {user.name || user.email}
                </summary>
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-border bg-surface p-2 shadow-xl">
                  <Link href="/account" className="block rounded-xl px-3 py-2 text-[13px] hover:bg-elevated">
                    Account
                  </Link>
                  <Link href="/new" className="block rounded-xl px-3 py-2 text-[13px] hover:bg-elevated">
                    New institution
                  </Link>
                  <form action={logoutAction}>
                    <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] hover:bg-elevated" type="submit">
                      <LogOut className="h-3.5 w-3.5" /> Log out
                    </button>
                  </form>
                </div>
              </details>
            ) : (
              <Link href="/login" className="rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-fg">
                Log in
              </Link>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6" aria-label="Primary">
            {items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
                    active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && <h1 className="text-[34px] font-semibold leading-none tracking-tight sm:text-[40px]">{title}</h1>}
            {subtitle && <p className="mt-2 max-w-xl text-[15px] leading-snug text-muted">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
