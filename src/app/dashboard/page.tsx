"use client";

import Link from "next/link";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DigitPop } from "@/components/ui/digit-pop";
import { Toggle } from "@/components/ui/toggle";

export default function DashboardPage() {
  const [shown, setShown] = useState(false);
  const [labsOnly, setLabsOnly] = useState(false);
  const [stats, setStats] = useState({
    rooms: 26,
    sections: 0,
    slots: 0,
    conflicts: 0,
    source: "empty",
  });

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/timetable/grid");
        const data = await res.json();
        if (cancelled) return;
        setStats({
          rooms: data.stats?.rooms ?? data.rooms?.length ?? 26,
          sections: data.stats?.sections ?? 0,
          slots: data.stats?.slots ?? 0,
          conflicts: data.stats?.conflicts ?? 0,
          source: data.source ?? "empty",
        });
      } catch {
        // keep defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasData = stats.slots > 0;

  return (
    <AppShell
      title="Home"
      subtitle="Aryabhatta & Kautalya · Academic year 2025–26"
    >
      <div
        className={`t-stagger mb-8 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 ${
          shown ? "is-shown" : ""
        }`}
      >
        <Stat label="Classrooms" value={String(stats.rooms)} sub="Full hall set" />
        <Stat
          label="Sections"
          value={hasData ? String(stats.sections || "—") : "—"}
          sub={hasData ? "Published" : "Upload to fill"}
        />
        <Stat
          label="Slots"
          value={hasData ? String(stats.slots) : "—"}
          sub={hasData ? "In grid" : "Not published"}
        />
        <Stat
          label="Conflicts"
          value={hasData ? String(stats.conflicts) : "—"}
          sub={hasData ? "Room overlaps" : "After publish"}
          ok={hasData && stats.conflicts === 0}
        />
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-[28px] border border-border bg-surface px-4 py-3">
        <div>
          <p className="text-[14px] font-semibold tracking-tight">Labs only</p>
          <p className="text-[12px] text-muted">Prefer lab rooms in vacancy search</p>
        </div>
        <Toggle checked={labsOnly} onChange={setLabsOnly} label="Labs only" />
      </div>

      <div className="mb-8 grid gap-2.5 sm:grid-cols-3">
        <Quick href="/vacancy" title="Find free room" body="Search by day and time" />
        <Quick href="/timetable/upload" title="Upload timetable" body="Excel with all 16 sections" />
        <Quick href="/students/upload" title="Student list" body="Drag-and-drop consolidation" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warn" strokeWidth={2} />
              Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!hasData ? (
              <Note
                tone="warn"
                title="Publish the 2025–26 Excel"
                detail="Parse on Upload, then Publish so Grid and vacancy use real occupancy."
              />
            ) : (
              <Note
                tone="muted"
                title="Timetable is live"
                detail={`${stats.slots} slots across ${stats.rooms} halls. Open Grid to browse by day.`}
              />
            )}
            <Note
              tone="muted"
              title="Combined labs stay one slot"
              detail="A1/A2 cells share a room. Review flags on upload if you need a second lab."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-ok" strokeWidth={2} />
              Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[14px] text-muted">
            <p className="flex items-start gap-2.5">
              <Upload className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              Parse all sheets → publish → grid fills.
            </p>
            <p className="flex items-start gap-2.5">
              <DoorOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              Teachers search free halls before requesting an extra class.
            </p>
            <p className="flex items-start gap-2.5">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
              Student lists drive consolidation when enrollment drops.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
}) {
  return (
    <div className="t-stagger-line t-stagger-line--1 rounded-[28px] border border-border bg-surface px-4 py-3.5">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p
        className={`mt-1 text-[28px] font-semibold tabular-nums tracking-tight leading-none ${
          ok ? "text-ok" : "text-fg"
        }`}
      >
        {value === "—" ? value : <DigitPop value={value} />}
      </p>
      <p className="mt-1.5 text-[12px] text-subtle">{sub}</p>
    </div>
  );
}

function Quick({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-[28px] border border-border bg-surface px-4 py-4 transition-colors hover:bg-elevated"
    >
      <div>
        <p className="text-[15px] font-semibold tracking-tight text-fg">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{body}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
    </Link>
  );
}

function Note({
  tone,
  title,
  detail,
}: {
  tone: "warn" | "muted";
  title: string;
  detail: string;
}) {
  return (
    <div
      className={`rounded-[20px] px-3.5 py-3 ${
        tone === "warn" ? "bg-accent-soft/40" : "bg-elevated"
      }`}
    >
      <p className="text-[14px] font-semibold tracking-tight text-fg">{title}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-muted">{detail}</p>
    </div>
  );
}
