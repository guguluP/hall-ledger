import Link from "next/link";
import { Calendar, DoorOpen, Users, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HALL_COUNT } from "@/lib/rooms";

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
          Aryabhatta & Kautalya · 1st year 2025–26
        </p>
        <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[48px] md:text-[56px]">
          Know every free classroom.
          <br />
          <span className="text-muted">Catch overlaps early.</span>
        </h1>
        <p className="mt-5 max-w-lg text-[17px] leading-snug text-muted">
          The 2025–26 timetable is already loaded. Search vacancies, review the
          grid, or replace it with a new Excel — across all {HALL_COUNT} halls.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/vacancy">
            <Button size="lg">
              <DoorOpen className="h-4 w-4" strokeWidth={2.25} />
              Find a free room
            </Button>
          </Link>
          <Link href="/timetable">
            <Button variant="secondary" size="lg">
              <Calendar className="h-4 w-4" strokeWidth={2.25} />
              Open grid
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
                  ? "border-[rgba(48,209,88,0.28)] bg-[rgba(48,209,88,0.08)]"
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
            body="Hard room overlaps flag on parse. Publish fills the live grid for every hall."
          />
          <Feature
            icon={<DoorOpen className="h-5 w-5" strokeWidth={1.75} />}
            title="Live vacancy search"
            body={`Day and time filters over the published grid — all ${HALL_COUNT} rooms, not a sample.`}
          />
          <Feature
            icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
            title="Section consolidation"
            body="Upload student lists, see enrollment diffs, and propose merges when sections shrink."
          />
        </div>

        <p className="mt-10 text-[13px] text-subtle">
          <Upload className="mr-1 inline h-3.5 w-3.5" strokeWidth={2} />
          Replace the seed anytime from{" "}
          <Link href="/timetable/upload" className="text-muted underline-offset-2 hover:text-fg hover:underline">
            Upload
          </Link>
          .
        </p>
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
