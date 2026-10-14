import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchInstitutions } from "@/lib/auth/service";
import { shellData } from "@/lib/shell";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [schools, shell] = await Promise.all([searchInstitutions(q), shellData()]);
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-accent-fg">
            <DoorOpen className="h-3.5 w-3.5" />
          </span>
          <span className="text-[15px] font-semibold">Hall Ledger</span>
        </div>
        <div className="flex gap-2">
          {shell.user ? (
            <Link href="/account"><Button size="sm" variant="secondary">Account</Button></Link>
          ) : (
            <Link href="/login"><Button size="sm" variant="secondary">Log in</Button></Link>
          )}
          <Link href="/signup"><Button size="sm">Sign up</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="mb-3 text-[13px] font-medium text-muted">One timetable for every institution</p>
        <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
          Know every free classroom.
          <br /><span className="text-muted">Catch overlaps early.</span>
        </h1>
        <p className="mt-5 max-w-lg text-[17px] text-muted">
          Students open a public link. Editors publish a CSV. Owners invite the rest of the staff.
        </p>
        <form className="mt-8 flex max-w-lg gap-2" action="/">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search a school"
            className="h-12 flex-1 rounded-full border border-border bg-elevated px-4 text-[15px] outline-none"
          />
          <Button type="submit">Search</Button>
        </form>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Link key={school.slug} href={`/${school.slug}`} className="rounded-2xl border border-border bg-surface p-5 hover:bg-elevated">
              <p className="text-[17px] font-semibold">{school.name}</p>
              <p className="mt-1 text-[13px] text-muted">/{school.slug}</p>
            </Link>
          ))}
          {schools.length === 0 && <p className="text-[14px] text-muted">No public institutions match that search.</p>}
        </div>
      </main>
    </div>
  );
}
