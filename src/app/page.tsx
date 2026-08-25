import Link from "next/link";
import { Calendar, DoorOpen, Users, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent text-accent-fg shadow-sm">
            <DoorOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Hall Ledger
          </span>
        </div>
        <Link href="/dashboard">
          <Button size="sm">Open app</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <p className="mb-3 text-[13px] font-medium tracking-wide text-muted">
          Aryabhatta &amp; Kautalya · 1st year 2025–26
        </p>
        <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[48px] md:text-[56px]">
          Know every free classroom.
          <br />
          <span className="text-muted">Catch overlaps early.</span>
        </h1>
        <p className="mt-5 max-w-lg text-[17px] leading-snug text-muted">
          Upload the college Excel, resolve room conflicts, then search vacancies
          and book extra classes across all 26 halls.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/timetable/upload">
            <Button size="lg">
              <Upload className="h-4 w-4" strokeWidth={2.25} />
              Upload timetable
            </Button>
          </Link>
          <Link href="/vacancy">
            <Button variant="secondary" size="lg">
              <DoorOpen className="h-4 w-4" strokeWidth={2.25} />
              Find a free room
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid max-w-sm grid-cols-4 gap-2">
          {[
            { n: "316", free: false },
            { n: "317", free: true },
            { n: "318", free: false },
            { n: "319", free: true },
            { n: "320", free: true },
            { n: "ME-01", free: false },
            { n: "ME-02", free: true },
            { n: "ME-03", free: true },
          ].map((r) => (
            <div
              key={r.n}
              className={`rounded-xl border p-3 ${
                r.free
                  ? "border-border/60 bg-transparent"
                  : "border-border bg-surface"
              }`}
            >
              <p className="text-[13px] font-semibold tabular-nums tracking-tight">
                {r.n}
              </p>
              <p
                className={`mt-1 text-[11px] font-medium ${
                  r.free ? "text-ok" : "text-muted"
                }`}
              >
                {r.free ? "Free" : "Busy"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 grid gap-3 md:grid-cols-3">
          <Feature
            icon={<Calendar className="h-5 w-5" strokeWidth={1.75} />}
            title="Conflict-free publish"
            body="Hard room overlaps block publish. Auto-resolve moves the extra section to a free hall."
          />
          <Feature
            icon={<DoorOpen className="h-5 w-5" strokeWidth={1.75} />}
            title="Live vacancy search"
            body="Day and time filters over the published grid — all 26 rooms, not a sample."
          />
          <Feature
            icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
            title="Section consolidation"
            body="Upload student lists, see enrollment diffs, and propose merges when sections shrink."
          />
        </div>
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </div>
      <h3 className="text-[17px] font-semibold tracking-tight text-fg">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-snug text-muted">{body}</p>
    </div>
  );
}
