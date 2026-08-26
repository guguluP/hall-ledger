"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DigitPop } from "@/components/ui/digit-pop";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { FULL_TIMETABLE_ROOMS } from "@/lib/rooms";

const DAYS = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
];

const TIME_SLOTS = [
  { start: "09:30", label: "9:30" },
  { start: "10:30", label: "10:30" },
  { start: "11:30", label: "11:30" },
  { start: "12:30", label: "12:30" },
  { start: "13:30", label: "1:30" },
  { start: "14:30", label: "2:30" },
  { start: "15:30", label: "3:30" },
  { start: "16:30", label: "4:30" },
];

type GridSlot = {
  classroomName: string;
  sectionName: string | null;
  subjectName: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
};

type GridRoom = { name: string; building?: string | null; capacity?: number };

export default function TimetablePage() {
  const [day, setDay] = useState(1);
  const [slots, setSlots] = useState<GridSlot[]>([]);
  const [rooms, setRooms] = useState<GridRoom[]>(
    FULL_TIMETABLE_ROOMS.map((name) => ({ name })),
  );
  const [stats, setStats] = useState({
    slots: 0,
    rooms: FULL_TIMETABLE_ROOMS.length,
    roomsInUse: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/timetable/grid");
        const data = await res.json();
        if (cancelled) return;
        const fromApi: GridRoom[] = Array.isArray(data.rooms) ? data.rooms : [];
        const byName = new Map<string, GridRoom>();
        for (const name of FULL_TIMETABLE_ROOMS) byName.set(name, { name });
        for (const r of fromApi) if (r?.name) byName.set(r.name, r);
        let ordered: GridRoom[];
        if (fromApi.length >= FULL_TIMETABLE_ROOMS.length) {
          const seen = new Set<string>();
          ordered = [];
          for (const r of fromApi) {
            if (!r?.name || seen.has(r.name)) continue;
            seen.add(r.name);
            ordered.push(r);
          }
          for (const name of FULL_TIMETABLE_ROOMS) {
            if (!seen.has(name)) ordered.push(byName.get(name)!);
          }
        } else {
          ordered = [...byName.values()];
        }
        setRooms(ordered);
        if (Array.isArray(data.slots)) setSlots(data.slots);
        if (data.stats) {
          setStats({
            ...data.stats,
            rooms: Math.max(data.stats.rooms ?? 0, ordered.length),
          });
        }
      } catch {
        setRooms(FULL_TIMETABLE_ROOMS.map((name) => ({ name })));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const daySlots = useMemo(
    () => slots.filter((s) => s.dayOfWeek === day),
    [slots, day],
  );

  const lookup = (room: string, start: string) =>
    daySlots.find((s) => s.classroomName === room && s.startTime === start);

  const dayMeta = DAYS.find((d) => d.value === day);

  return (
    <AppShell
      title="Timetable"
      subtitle="Every hall from the published 2025-26 schedule"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Metric label="Slots" value={loading ? "-" : String(stats.slots)} animate={!loading} />
          <Metric label="Rooms" value={String(rooms.length)} animate />
          <Metric
            label="In use"
            value={loading ? "-" : String(stats.roomsInUse || rooms.length)}
            animate={!loading}
          />
        </div>
        <Link href="/timetable/upload">
          <Button size="sm">
            <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
            Upload
          </Button>
        </Link>
      </div>

      {loading && (
        <p className="mb-4 text-[13px]">
          <span className="t-shimmer" data-text="Loading published grid...">
            Loading published grid...
          </span>
        </p>
      )}

      <div className="mb-6">
        <SlidingTabs
          items={DAYS.map((d) => ({ value: d.value, label: d.label }))}
          value={day}
          onChange={(v) => setDay(Number(v))}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight text-fg">
            {dayMeta?.full ?? "Day"}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {rooms.length} halls · scroll for the full set
          </p>
        </div>

        <div className="scroll-touch overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-surface px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  Time
                </th>
                {rooms.map((r) => (
                  <th
                    key={r.name}
                    className="min-w-[5.5rem] px-2 py-3 text-center text-[12px] font-semibold tabular-nums tracking-tight text-fg"
                  >
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((t, rowIdx) => (
                <tr
                  key={t.start}
                  className={rowIdx % 2 === 0 ? "bg-transparent" : "bg-black/20"}
                >
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-[13px] font-medium tabular-nums text-muted">
                    {t.label}
                  </td>
                  {rooms.map((r) => {
                    const hit = lookup(r.name, t.start);
                    return (
                      <td key={r.name} className="px-1.5 py-1.5 text-center">
                        {hit ? (
                          <span
                            className="inline-flex max-w-[6.5rem] items-center justify-center truncate rounded-lg bg-accent-soft px-2 py-1.5 text-[11px] font-medium leading-tight tracking-tight text-accent"
                            title={[hit.sectionName, hit.subjectName].filter(Boolean).join(" · ") || undefined}
                          >
                            {hit.sectionName || hit.subjectName || "Booked"}
                          </span>
                        ) : (
                          <span className="inline-block text-[13px] text-subtle/50">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-border px-5 py-3.5 text-[12px] leading-snug text-subtle">
          All {rooms.length} rooms from the 2025-26 workbook.
        </p>
      </section>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  animate,
}: {
  label: string;
  value: string;
  animate?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-fg">
        {animate ? <DigitPop value={value} /> : value}
      </span>
    </div>
  );
}
