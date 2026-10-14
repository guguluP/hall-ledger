"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DigitPop } from "@/components/ui/digit-pop";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { buildTimeRows, findSlot, type OccupancySlot } from "@/lib/occupancy";
import { labelTime } from "@/lib/time";

const DAYS = [
  { value: 1, label: "Mon", full: "Monday" },
  { value: 2, label: "Tue", full: "Tuesday" },
  { value: 3, label: "Wed", full: "Wednesday" },
  { value: 4, label: "Thu", full: "Thursday" },
  { value: 5, label: "Fri", full: "Friday" },
  { value: 6, label: "Sat", full: "Saturday" },
];

type Room = { name: string; building?: string | null; capacity?: number };

export function TimetableGrid({ slug, canUpload }: { slug: string; canUpload: boolean }) {
  const [day, setDay] = useState(1);
  const [slots, setSlots] = useState<OccupancySlot[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState({ slots: 0, roomsInUse: 0 });
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/i/${slug}/timetable`);
        const data = await res.json();
        if (cancelled) return;
        setRooms(Array.isArray(data.rooms) ? data.rooms : []);
        setSlots(Array.isArray(data.slots) ? data.slots : []);
        setStats({ slots: data.stats?.slots || 0, roomsInUse: data.stats?.roomsInUse || 0 });
        setFileName(data.fileName || "");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const daySlots = useMemo(() => slots.filter((slot) => Number(slot.dayOfWeek) === day), [slots, day]);
  const timeRows = useMemo(() => {
    const rows = buildTimeRows(slots);
    return rows.length ? rows : [{ start: "09:30", label: labelTime("09:30") }];
  }, [slots]);
  const dayMeta = DAYS.find((item) => item.value === day);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Metric label="Slots" value={loading ? "-" : String(stats.slots)} />
          <Metric label="Rooms" value={String(rooms.length)} />
          <Metric label="In use" value={loading ? "-" : String(stats.roomsInUse)} />
        </div>
        {canUpload && (
          <Link href={`/${slug}/manage/upload`}>
            <Button size="sm"><Upload className="h-3.5 w-3.5" /> Replace</Button>
          </Link>
        )}
      </div>
      <div className="mb-6">
        <SlidingTabs items={DAYS.map((item) => ({ value: item.value, label: item.label }))} value={day} onChange={(value) => setDay(Number(value))} />
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold">{dayMeta?.full}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{rooms.length} halls · {fileName || "published schedule"}</p>
        </div>
        <div className="scroll-touch overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-surface px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">Time</th>
                {rooms.map((room) => (
                  <th key={room.name} className="min-w-[5.5rem] px-2 py-3 text-center text-[12px] font-semibold tabular-nums">{room.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeRows.map((row, index) => (
                <tr key={row.start} className={index % 2 ? "bg-black/20" : ""}>
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-[13px] font-medium tabular-nums text-muted">{row.label}</td>
                  {rooms.map((room) => {
                    const hit = findSlot(daySlots, room.name, day, row.start);
                    return (
                      <td key={room.name} className="px-1.5 py-1.5 text-center">
                        {hit ? (
                          <span className="inline-flex max-w-[6.5rem] truncate rounded-lg bg-accent-soft px-2 py-1.5 text-[11px] font-medium text-accent" title={[hit.sectionName, hit.subjectName].filter(Boolean).join(" · ")}>
                            {hit.sectionName || hit.subjectName || "Booked"}
                          </span>
                        ) : (
                          <span className="text-[13px] text-subtle/50">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value === "-" ? value : <DigitPop value={value} />}</span>
    </div>
  );
}
