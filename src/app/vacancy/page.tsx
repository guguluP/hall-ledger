"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, DoorOpen, Search, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { SuccessCheck } from "@/components/ui/success-check";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";
import { Toggle } from "@/components/ui/toggle";
import { triggerInputError, swapText } from "@/lib/transitions";
import { resolvePublished, loadLabsOnly, saveLabsOnly } from "@/lib/client-cache";
import { findFreeRooms, type FreeRoom } from "@/lib/occupancy";
import { FULL_TIMETABLE_ROOMS, buildingOf } from "@/lib/rooms";
import { padTime } from "@/lib/time";

const DAYS = [
  { value: "1", label: "Mon" }, { value: "2", label: "Tue" }, { value: "3", label: "Wed" },
  { value: "4", label: "Thu" }, { value: "5", label: "Fri" }, { value: "6", label: "Sat" },
];

const fieldClass =
  "t-input h-11 w-full rounded-full border border-border bg-elevated px-4 text-[15px] text-fg outline-none transition-shadow focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg)]";

export default function VacancyPage() {
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("12:30");
  const [results, setResults] = useState<FreeRoom[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const [labsOnly, setLabsOnly] = useState(false);
  const [hasPublished, setHasPublished] = useState(false);
  const endWrapRef = useRef<HTMLDivElement>(null);
  const btnLabelRef = useRef<HTMLSpanElement>(null);
  const { items, push } = useToastStack();

  useEffect(() => { setLabsOnly(loadLabsOnly()); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/timetable/grid");
        const data = await res.json();
        if (cancelled) return;
        const best = resolvePublished(data);
        setHasPublished(!!(best?.slots && (best.slots as unknown[]).length > 0));
      } catch {
        const local = resolvePublished(null);
        setHasPublished(!!(local?.slots && (local.slots as unknown[]).length > 0));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLabs = (v: boolean) => { setLabsOnly(v); saveLabsOnly(v); };

  const handleSearch = async () => {
    if (endTime <= startTime) {
      triggerInputError(endWrapRef.current);
      push("Invalid time window", "End time must be after start time.", "danger");
      return;
    }
    setLoading(true);
    if (btnLabelRef.current) await swapText(btnLabelRef.current, "Searching…");
    try {
      const res = await fetch(
        `/api/vacancy?day=${day}&start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}&labs=${labsOnly ? "1" : "0"}`,
      );
      const data = await res.json();
      let free: FreeRoom[] = Array.isArray(data.rooms) ? data.rooms : [];
      if ((!free.length && data.source === "empty") || !res.ok) {
        const gridRes = await fetch("/api/timetable/grid").catch(() => null);
        const gridData = gridRes ? await gridRes.json().catch(() => null) : null;
        const best = resolvePublished(gridData);
        if (best?.slots?.length) {
          const rooms = (best.rooms?.length
            ? best.rooms
            : FULL_TIMETABLE_ROOMS.map((name) => ({ name, building: buildingOf(name), capacity: 60 }))
          ) as { name: string; building?: string; capacity?: number }[];
          free = findFreeRooms(rooms, best.slots as any, Number(day), padTime(startTime), padTime(endTime), labsOnly);
        }
      }
      setResults(free);
      setFound(true);
      if (!free.length && !hasPublished) {
        push("No published timetable", "Upload and Publish a timetable first.", "danger");
      } else {
        push("Rooms found", `${free.length} free halls in this window.`, "ok");
      }
    } catch {
      push("Search failed", "Could not load occupancy.", "danger");
      setResults([]);
      setFound(true);
    } finally {
      setLoading(false);
      if (btnLabelRef.current) await swapText(btnLabelRef.current, "Search");
    }
  };

  return (
    <AppShell title="Find a room" subtitle="Uses the published timetable across all halls">
      <div className="mb-5">
        <SlidingTabs items={DAYS} value={day} onChange={(v) => setDay(String(v))} />
      </div>
      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Search</h2>
          <p className="mt-0.5 text-[13px] text-muted">Day and window · results respect published occupancy</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">From</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldClass} />
          </label>
          <div className="t-input-wrap block" ref={endWrapRef}>
            <span className="mb-1.5 block text-[12px] font-medium text-muted">To</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldClass} />
            <p className="t-error-msg">End must be after start time.</p>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" strokeWidth={2.25} />
              <span ref={btnLabelRef} className="t-text-swap">Search</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div>
            <p className="text-[14px] font-semibold tracking-tight">Labs only</p>
            <p className="text-[12px] text-muted">Show lab rooms only</p>
          </div>
          <Toggle checked={labsOnly} onChange={handleLabs} label="Labs only" />
        </div>
      </section>
      {found && results && (
        <div className="mb-4 flex items-center gap-3">
          <SuccessCheck show size={36} />
          <p className="text-[14px] text-muted">
            <span className="font-semibold text-fg">{results.length}</span> free classrooms
          </p>
        </div>
      )}
      {results && results.length > 0 && (
        <div className="space-y-2.5">
          {results.map((room) => (
            <div key={room.id} className="flex flex-col justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[20px] font-semibold tabular-nums tracking-tight">{room.name}</h3>
                  <span className="rounded-full bg-[rgba(48,209,88,0.15)] px-2.5 py-0.5 text-[11px] font-semibold text-ok">Free</span>
                </div>
                <p className="mt-1.5 flex flex-wrap gap-3 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" strokeWidth={2} /> {room.capacity}</span>
                  <span>{room.building}</span>
                  {room.isLab && <span>Lab</span>}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ok">
                  <Clock className="h-4 w-4" strokeWidth={2} />
                  {room.freeFrom}–{room.freeUntil}
                </p>
                <p className="mt-1 text-[12px] text-subtle">{room.nextBooking ? `Next: ${room.nextBooking}` : "No later booking"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {results && results.length === 0 && (
        <div className="py-16 text-center">
          <DoorOpen className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
          <p className="text-[15px] text-muted">No free rooms in this window.</p>
        </div>
      )}
      {!results && (
        <div className="py-20 text-center">
          <DoorOpen className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
          <p className="text-[15px] text-muted">Pick a day and time, then search.</p>
        </div>
      )}
      <ToastStack items={items} />
    </AppShell>
  );
}
