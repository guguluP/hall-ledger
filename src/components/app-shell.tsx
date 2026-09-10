"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  DoorOpen,
  LayoutDashboard,
  Users,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, match: "home" },
  { href: "/vacancy", label: "Find", icon: DoorOpen, match: "find" },
  { href: "/timetable", label: "Grid", icon: Calendar, match: "grid" },
  { href: "/students", label: "Students", icon: Users, match: "students" },
  { href: "/timetable/upload", label: "Upload", icon: ClipboardList, match: "upload" },
];

function isActive(match: string, pathname: string) {
  if (match === "home") return pathname === "/dashboard";
  if (match === "find") return pathname === "/vacancy" || pathname.startsWith("/vacancy/");
  if (match === "grid") return pathname === "/timetable" || pathname === "/grid";
  if (match === "students") return pathname === "/students" || pathname.startsWith("/students/");
  if (match === "upload") return pathname.startsWith("/timetable/upload");
  return false;
}

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-border glass-strong">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:h-14 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Hall Ledger home">
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-accent-fg shadow-sm">
              <DoorOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-fg">
              Hall Ledger
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(item.match, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150",
                    active
                      ? "bg-elevated text-fg"
                      : "text-muted hover:text-fg",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-12">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h1 className="text-[34px] font-semibold leading-none tracking-tight text-fg sm:text-[40px]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 max-w-xl text-[15px] leading-snug text-muted">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border glass-strong md:hidden" aria-label="Primary">
        <div className="grid grid-cols-5 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {NAV.map((item) => {
            const active = isActive(item.match, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <item.icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
