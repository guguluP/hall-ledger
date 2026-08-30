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
import { findAvailability, type FreeRoom } from "@/lib/occupancy";
import { FULL_TIMETABLE_ROOMS, buildingOf } from "@/lib/rooms";
import { labelTime, normalizeWindow } from "@/lib/time";

const DAYS = [
  { value: "1", label: "Mon" }, { value: "2", label: "Tue" }, { value: "3", label: "Wed" },
  { value: "4", label: "Thu" }, { value: "5", label: "Fri" }, { value: "6", label: "Sat" },
];

const PRESETS = [
  { start: "09:30", end: "10:30", label: "9:30–10:30 AM" },
  { start: "10:30", end: "12:30", label: "10:30 AM–12:30 PM" },
  { start: "14:30", end: "16:30", label: "2:30–4:30 PM" },
  { start: "09:30", end: "17:30", label: "Full day 9:30 AM–5:30 PM" },
];

const fieldClass =
  "t-input h-11 w-full rounded-full border border-border bg-elevated px-4 text-[15px] text-fg outline-none transition-shadow focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg)]";

type Hall = { name: string; building?: string; capacity?: number };

function hallsFrom(best: { rooms?: Hall[] } | null): Hall[] {
  if (best?.rooms?.length) return best.rooms;
  return FULL_TIMETABLE_ROOMS.map((name) => ({ name, building: buildingOf(name), capacity: 60 }));
}

export default function VacancyPage() {
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("12:30");
  const [results, setResults] = useState<FreeRoom[] | null>(null);
  const [partial, setPartial] = useState<FreeRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const [labsOnly, setLabsOnly] = useState(false);
  const [hasPublished, setHasPublished] = useState(false);
  const [windowLabel, setWindowLabel] = useState("");
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

  const applyLocal = (start: string, end: string) => {
    type OccupancyLike = {
      classroomName: string;
      sectionName?: string | null;
      subjectName?: string | null;
      dayOfWeek: number | null;
      startTime: string;
      endTime: string;
    };
    const cached = resolvePublished<{ slots: OccupancyLike[]; rooms: Hall[] }>(null);
    if (!cached?.slots?.length) {
      return { free: [] as FreeRoom[], partial: [] as FreeRoom[], published: false };
    }
    const avail = findAvailability(
      hallsFrom(cached),
      cached.slots,
      Number(day),
      start,
      end,
      labsOnly,
    );
    return { ...avail, published: true };
  };

  const handleSearch = async (preset?: { start: string; end: string }) => {
    const from = preset?.start ?? startTime;
    const to = preset?.end ?? endTime;
    if (preset) {
      setStartTime(preset.start);
      setEndTime(preset.end);
    }

    const win = normalizeWindow(from, to);
    if (!win) {
      triggerInputError(endWrapRef.current);
      push("Invalid time window", "End must be after start. Use 5:30 PM as 17:30, or pick Full day.", "danger");
      return;
    }
    if (win.interpretedPm) {
      setEndTime(win.end);
    }

    setLoading(true);
    setWindowLabel(`${labelTime(win.start)} – ${labelTime(win.end)}`);
    if (btnLabelRef.current) await swapText(btnLabelRef.current, "Searching…");

    try {
      const res = await fetch(
        `/api/vacancy?day=${day}&start=${encodeURIComponent(win.start)}&end=${encodeURIComponent(win.end)}&labs=${labsOnly ? "1" : "0"}`,
      );
      const data = await res.json();
      let free: FreeRoom[] = Array.isArray(data.rooms) ? data.rooms : [];
      let part: FreeRoom[] = Array.isArray(data.partial) ? data.partial : [];

      // Serverless instances often have no published copy. Always prefer
      // local occupancy when the API has none — never treat "empty" as all-free.
      if (!res.ok || data.source === "empty") {
        const local = applyLocal(win.start, win.end);
        if (local.published) {
          free = local.free;
          part = local.partial;
        } else {
          free = [];
          part = [];
        }
      }

      setResults(free);
      setPartial(part);
      setFound(true);

      if (!free.length && !part.length && !hasPublished && data.source === "empty") {
        push("No published timetable", "Upload and Publish a timetable first.", "danger");
      } else if (win.start === "09:30" && win.end === "17:30") {
        push(
          free.length ? "Free all day" : "No hall is free all day",
          free.length
            ? `${free.length} hall${free.length === 1 ? "" : "s"} with no classes ${labelTime(win.start)} – ${labelTime(win.end)}.`
            : `${part.length} hall${part.length === 1 ? "" : "s"} have shorter free gaps.`,
          free.length ? "ok" : "danger",
        );
      } else {
        push(
          free.length ? "Rooms found" : "No fully free halls",
          free.length
            ? `${free.length} free for ${labelTime(win.start)} – ${labelTime(win.end)}.`
            : part.length
              ? "None cover the whole window — open slots listed below."
              : "Every hall is booked for this window.",
          free.length ? "ok" : "danger",
        );
      }
    } catch {
      const local = applyLocal(win.start, win.end);
      if (local.published) {
        setResults(local.free);
        setPartial(local.partial);
        setFound(true);
        push("Rooms found", `${local.free.length} free halls in this window.`, "ok");
      } else {
        push("Search failed", "Could not load occupancy.", "danger");
        setResults([]);
        setPartial([]);
        setFound(true);
      }
    } finally {
      setLoading(false);
      if (btnLabelRef.current) await swapText(btnLabelRef.current, "Search");
    }
  };

  const isFullDay = startTime === "09:30" && (endTime === "17:30" || endTime === "05:30");

  return (
    <AppShell title="Find a room" subtitle="Uses the published timetable across all halls">
      <div className="mb-5">
        <SlidingTabs items={DAYS} value={day} onChange={(v) => setDay(String(v))} />
      </div>
      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight">Search</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            A hall is free only if it has no class in the whole window
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
          {PRESETS.map((p) => {
            const active = startTime === p.start && endTime === p.end;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { void handleSearch(p); }}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-accent text-accent-fg"
                    : "bg-elevated text-muted hover:text-fg"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">From</span>
            <input type="time" step={1800} value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldClass} />
          </label>
          <div className="t-input-wrap block" ref={endWrapRef}>
            <span className="mb-1.5 block text-[12px] font-medium text-muted">To</span>
            <input type="time" step={1800} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldClass} />
            <p className="t-error-msg">End must be after start time.</p>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => handleSearch()} disabled={loading}>
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
          <SuccessCheck show={results.length > 0} size={36} />
          <p className="text-[14px] text-muted">
            <span className="font-semibold text-fg">{results.length}</span>
            {isFullDay ? " free all day" : " free for the whole window"}
            {windowLabel ? <span className="text-subtle"> · {windowLabel}</span> : null}
          </p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="mb-8 space-y-2.5">
          {results.map((room) => (
            <RoomCard key={room.id} room={room} fullDay={isFullDay} />
          ))}
        </div>
      )}

      {results && results.length === 0 && found && (
        <div className="mb-8 py-10 text-center">
          <DoorOpen className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
          <p className="text-[15px] text-muted">
            {hasPublished
              ? isFullDay
                ? "No hall is free for the full day. Open slots below."
                : "No hall is free for this entire window."
              : "Publish a timetable first so vacancy uses real occupancy."}
          </p>
        </div>
      )}

      {partial.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-[15px] font-semibold tracking-tight">
            Open slots in this window
          </h3>
          <p className="mb-3 text-[13px] text-muted">
            These halls are booked for part of the window — not free 9:30 AM–5:30 PM.
          </p>
          <div className="space-y-2.5">
            {partial.map((room) => (
              <RoomCard key={`p-${room.id}`} room={room} partial />
            ))}
          </div>
        </section>
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

function RoomCard({
  room,
  partial,
  fullDay,
}: {
  room: FreeRoom;
  partial?: boolean;
  fullDay?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[20px] font-semibold tabular-nums tracking-tight">{room.name}</h3>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              partial
                ? "bg-[rgba(255,214,10,0.18)] text-warn"
                : "bg-[rgba(48,209,88,0.15)] text-ok"
            }`}
          >
            {partial ? "Partial" : fullDay ? "Free all day" : "Free"}
          </span>
        </div>
        <p className="mt-1.5 flex flex-wrap gap-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" strokeWidth={2} /> {room.capacity}</span>
          <span>{room.building}</span>
          {room.isLab && <span>Lab</span>}
        </p>
        {partial && room.gaps?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {room.gaps.map((g) => (
              <span
                key={`${g.from}-${g.until}`}
                className="rounded-full bg-elevated px-2.5 py-1 text-[11px] font-medium tabular-nums text-fg"
              >
                {g.from} – {g.until}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="sm:text-right">
        <p className={`inline-flex items-center gap-1.5 text-[14px] font-semibold ${partial ? "text-fg" : "text-ok"}`}>
          <Clock className="h-4 w-4" strokeWidth={2} />
          {room.freeFrom} – {room.freeUntil}
        </p>
        <p className="mt-1 text-[12px] text-subtle">
          {room.nextBooking ? `Next: ${room.nextBooking}` : "No later booking"}
        </p>
      </div>
    </div>
  );
}
