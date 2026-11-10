"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, DoorOpen, Search, Star, Users } from "lucide-react";
import { reportRoom } from "@/lib/actions/campus";
import { Button } from "@/components/ui/button";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { SuccessCheck } from "@/components/ui/success-check";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";
import { Toggle } from "@/components/ui/toggle";
import { loadLabsOnly, saveLabsOnly } from "@/lib/client-cache";
import { parsePlainQuery } from "@/lib/query";
import { triggerInputError, swapText } from "@/lib/transitions";
import { labelTime } from "@/lib/time";
import type { FreeRoom } from "@/lib/occupancy";

const DAYS = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

const PRESETS = [
  { start: "09:30", end: "10:30", label: "9:30–10:30 AM" },
  { start: "10:30", end: "12:30", label: "10:30 AM–12:30 PM" },
  { start: "14:30", end: "16:30", label: "2:30–4:30 PM" },
  { start: "09:30", end: "17:30", label: "Full day 9:30 AM–5:30 PM" },
];

const fieldClass =
  "t-input h-11 w-full rounded-full border border-border bg-elevated px-4 text-[15px] text-fg outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

type ListedRoom = FreeRoom & { report?: string | null; freeForMin?: number | null };
type Counts = { total: number; occupied: number; closed: boolean; exam: boolean; reason: string };

function favouriteKey(slug: string) {
  return `hall-ledger-favourites:${slug}`;
}

export function FindRooms({ slug, today, date }: { slug: string; today: number; date: string }) {
  const [mode, setMode] = useState<"now" | "plan">("now");
  const [day, setDay] = useState(String(today));
  const [startTime, setStartTime] = useState("10:30");
  const [endTime, setEndTime] = useState("12:30");
  const [plain, setPlain] = useState("");
  const [seats, setSeats] = useState("");
  const [section, setSection] = useState("");
  const [projector, setProjector] = useState(false);
  const [board, setBoard] = useState(false);
  const [ac, setAc] = useState(false);
  const [results, setResults] = useState<ListedRoom[] | null>(null);
  const [partial, setPartial] = useState<ListedRoom[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const [labsOnly, setLabsOnly] = useState(false);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [hasPublished, setHasPublished] = useState(false);
  const [windowLabel, setWindowLabel] = useState("");
  const endWrapRef = useRef<HTMLDivElement>(null);
  const btnLabelRef = useRef<HTMLSpanElement>(null);
  const modeRef = useRef(mode);
  const searchRef = useRef<(preset?: { start: string; end: string }, live?: boolean) => Promise<void>>(async () => undefined);
  modeRef.current = mode;
  const { items, push } = useToastStack();

  useEffect(() => {
    setLabsOnly(loadLabsOnly());
    try {
      const saved = JSON.parse(localStorage.getItem(favouriteKey(slug)) || "[]");
      if (Array.isArray(saved)) setFavourites(saved.filter((item) => typeof item === "string"));
    } catch {
      setFavourites([]);
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/i/${slug}/timetable`);
      const data = await res.json();
      if (cancelled) return;
      const slots = Array.isArray(data.slots) ? data.slots : [];
      setHasPublished(slots.length > 0);
      setSections([...new Set(slots.map((slot: { sectionName?: string }) => slot.sectionName).filter(Boolean))] as string[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const search = async (preset?: { start: string; end: string }, live = mode === "now") => {
    const from = preset?.start ?? startTime;
    const to = preset?.end ?? endTime;
    if (preset) {
      setStartTime(preset.start);
      setEndTime(preset.end);
    }
    if (!live && from >= to) {
      triggerInputError(endWrapRef.current);
      push("Invalid time window", "End must be after start.", "danger");
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      day: live ? String(today) : day,
      start: from,
      end: to,
      labs: labsOnly ? "1" : "0",
    });
    if (live) {
      params.set("now", "1");
      params.set("date", date);
    }
    if (seats) params.set("seats", seats);
    if (section) params.set("section", section);
    if (projector) params.set("projector", "1");
    if (board) params.set("board", "1");
    if (ac) params.set("ac", "1");
    if (btnLabelRef.current) await swapText(btnLabelRef.current, "Searching…");
    try {
      const res = await fetch(`/api/i/${slug}/vacancy?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        push("Invalid time window", data.fields?.end || data.fields?.start || data.error || "Check the time window.", "danger");
        setResults([]);
        setPartial([]);
        setFound(true);
        return;
      }
      const free: ListedRoom[] = Array.isArray(data.rooms) ? data.rooms : [];
      const part: ListedRoom[] = Array.isArray(data.partial) ? data.partial : [];
      setResults(free);
      setPartial(part);
      setCounts({
        total: Number(data.total) || 0,
        occupied: Number(data.occupied) || 0,
        closed: Boolean(data.closed),
        exam: Boolean(data.exam),
        reason: data.reason || "",
      });
      setWindowLabel(data.start && data.end ? `${labelTime(data.start)} – ${labelTime(data.end)}` : "");
      setFound(true);
      if (data.closed) push("Campus closed", data.reason || "No room is free to use.", "danger");
      else push(free.length ? "Rooms found" : "No fully free halls", free.length ? `${free.length} free for this window.` : "None cover the whole window.", free.length ? "ok" : "danger");
    } catch {
      push("Search failed", "Could not load occupancy.", "danger");
    } finally {
      setLoading(false);
      if (btnLabelRef.current) await swapText(btnLabelRef.current, "Search");
    }
  };

  searchRef.current = search;

  useEffect(() => {
    void searchRef.current(undefined, true);
    const timer = window.setInterval(() => {
      if (modeRef.current === "now") void searchRef.current(undefined, true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [slug]);

  function applyPlain() {
    const parsed = parsePlainQuery(plain);
    if (!parsed) {
      push("Could not read that", "Try “lab for 40, Tue 2–4”.", "danger");
      return;
    }
    setMode("plan");
    if (parsed.day != null) setDay(String(parsed.day));
    if (parsed.start) setStartTime(parsed.start);
    if (parsed.end) setEndTime(parsed.end);
    if (parsed.seats) setSeats(String(parsed.seats));
    if (parsed.labs) {
      setLabsOnly(true);
      saveLabsOnly(true);
    }
    if (parsed.projector) setProjector(true);
    if (parsed.board) setBoard(true);
    if (parsed.ac) setAc(true);
    const from = parsed.start || startTime;
    const to = parsed.end || endTime;
    void search({ start: from, end: to }, false);
  }

  function toggleFavourite(name: string) {
    const next = favourites.includes(name) ? favourites.filter((item) => item !== name) : [...favourites, name];
    setFavourites(next);
    localStorage.setItem(favouriteKey(slug), JSON.stringify(next));
  }

  const visible = (list: ListedRoom[]) => list.filter((room) => !favouritesOnly || favourites.includes(room.name));
  const shown = results ? visible(results) : [];
  const shownPartial = visible(partial);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => { setMode("now"); void search(undefined, true); }} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${mode === "now" ? "bg-accent text-accent-fg" : "bg-elevated text-muted"}`}>Free now</button>
        <button type="button" onClick={() => setMode("plan")} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${mode === "plan" ? "bg-accent text-accent-fg" : "bg-elevated text-muted"}`}>Pick a time</button>
      </div>
      {mode === "plan" && (
        <div className="mb-5">
          <SlidingTabs items={DAYS} value={day} onChange={(value) => setDay(String(value))} />
        </div>
      )}
      <section className="mb-6 overflow-hidden rounded-[28px] border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight">{mode === "now" ? "Free now" : "Search"}</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {mode === "now" ? "Today in India Standard Time. This refreshes every minute." : "A hall is free only if it has no class in the whole window."}
          </p>
        </div>
        <div className="border-b border-border px-5 py-3">
          <div className="flex gap-2">
            <input value={plain} onChange={(event) => setPlain(event.target.value)} placeholder="lab for 40, Tue 2–4" className={fieldClass} aria-label="Plain language search" />
            <Button type="button" variant="secondary" onClick={applyPlain}>Use</Button>
          </div>
        </div>
        {mode === "plan" && (
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" onClick={() => void search(preset, false)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${startTime === preset.start && endTime === preset.end ? "bg-accent text-accent-fg" : "bg-elevated text-muted"}`}>
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {mode === "plan" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-muted">From</span>
                <input type="time" step={1800} value={startTime} onChange={(event) => setStartTime(event.target.value)} className={fieldClass} />
              </label>
              <div className="t-input-wrap block" ref={endWrapRef}>
                <span className="mb-1.5 block text-[12px] font-medium text-muted">To</span>
                <input type="time" step={1800} value={endTime} onChange={(event) => setEndTime(event.target.value)} className={fieldClass} />
                <p className="t-error-msg">End must be after start time.</p>
              </div>
            </>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">At least</span>
            <input inputMode="numeric" value={seats} onChange={(event) => setSeats(event.target.value.replace(/[^\d]/g, "").slice(0, 3))} placeholder="Seats" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">Section size</span>
            <select value={section} onChange={(event) => setSection(event.target.value)} className={fieldClass}>
              <option value="">Any section</option>
              {sections.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          <Filter checked={projector} label="Projector" onChange={setProjector} />
          <Filter checked={board} label="Smart board" onChange={setBoard} />
          <Filter checked={ac} label="AC" onChange={setAc} />
          <Filter checked={favouritesOnly} label="Favourites" onChange={setFavouritesOnly} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div>
            <p className="text-[14px] font-semibold">Labs only</p>
            <p className="text-[12px] text-muted">Counts include labs only</p>
          </div>
          <Toggle checked={labsOnly} onChange={(value) => { setLabsOnly(value); saveLabsOnly(value); }} label="Labs only" />
        </div>
        <div className="border-t border-border p-5">
          <Button className="w-full" onClick={() => void search(undefined, mode === "now")} disabled={loading}>
            <Search className="h-4 w-4" />
            <span ref={btnLabelRef} className="t-text-swap">Search</span>
          </Button>
        </div>
      </section>
      {found && counts && (
        <div className="mb-4 flex items-center gap-3">
          <SuccessCheck show={Boolean(shown.length) && !counts.closed} size={36} />
          <div>
            <p className="text-[14px] text-muted">
              {counts.closed ? counts.reason : (
                <>
                  <span className="font-semibold text-fg">{shown.length}</span>
                  {mode === "now" ? " free now" : " free for the whole window"}
                  <span className="text-subtle"> · {counts.occupied} of {counts.total} occupied{labsOnly ? " (labs)" : ""}</span>
                </>
              )}
            </p>
            {windowLabel && !counts.closed && <p className="text-[12px] text-subtle">{windowLabel}{counts.exam ? ` · ${counts.reason}` : ""}</p>}
          </div>
        </div>
      )}
      {shown.length > 0 && (
        <div className="mb-8 space-y-2.5">
          {shown.map((room) => (
            <RoomCard key={room.id} slug={slug} room={room} live={mode === "now"} favourite={favourites.includes(room.name)} onFavourite={toggleFavourite} />
          ))}
        </div>
      )}
      {results && shown.length === 0 && found && !counts?.closed && (
        <div className="mb-8 py-10 text-center">
          <DoorOpen className="mx-auto mb-3 h-10 w-10 text-subtle" />
          <p className="text-[15px] text-muted">{hasPublished ? "No hall is free for this entire window." : "Publish a timetable first so vacancy uses real occupancy."}</p>
        </div>
      )}
      {shownPartial.length > 0 && !counts?.closed && (
        <section className="mb-8">
          <h3 className="mb-3 text-[15px] font-semibold">Open slots in this window</h3>
          <div className="space-y-2.5">
            {shownPartial.map((room) => (
              <RoomCard key={`p-${room.id}`} slug={slug} room={room} partial live={mode === "now"} favourite={favourites.includes(room.name)} onFavourite={toggleFavourite} />
            ))}
          </div>
        </section>
      )}
      <ToastStack items={items} />
    </>
  );
}

function Filter({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${checked ? "bg-accent text-accent-fg" : "bg-elevated text-muted"}`}>
      {label}
    </button>
  );
}

function RoomCard({
  slug,
  room,
  partial,
  live,
  favourite,
  onFavourite,
}: {
  slug: string;
  room: ListedRoom;
  partial?: boolean;
  live?: boolean;
  favourite: boolean;
  onFavourite: (name: string) => void;
}) {
  const [note, setNote] = useState(room.report || "");
  return (
    <div className="flex flex-col justify-between gap-3 rounded-[28px] border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-[20px] font-semibold tabular-nums">{room.name}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${partial ? "bg-[rgba(255,214,10,0.18)] text-warn" : "bg-[rgba(48,209,88,0.15)] text-ok"}`}>
            {partial ? "Partial" : live && room.freeForMin != null ? `Free for ${room.freeForMin} min` : "Free"}
          </span>
          {note === "LOCKED" && <span className="rounded-full bg-[rgba(255,69,58,0.15)] px-2.5 py-0.5 text-[11px] font-semibold text-danger">Reported locked</span>}
          {note === "FREE" && <span className="rounded-full bg-elevated px-2.5 py-0.5 text-[11px] font-semibold text-muted">Reported free</span>}
        </div>
        <p className="mt-1.5 flex flex-wrap gap-3 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {room.capacity ?? "—"}</span>
          <span>{room.building || "No building"}</span>
          {room.isLab && <span>Lab</span>}
          {room.floor != null && <span>Floor {room.floor}</span>}
          {room.hasProjector && <span>Projector</span>}
          {room.hasSmartBoard && <span>Smart board</span>}
          {room.hasAc && <span>AC</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="text-[12px] text-accent" onClick={() => onFavourite(room.name)}>
            <Star className={`mr-1 inline h-3.5 w-3.5 ${favourite ? "fill-current" : ""}`} />{favourite ? "Saved" : "Save"}
          </button>
          <button type="button" className="text-[12px] text-muted" onClick={async () => { const result = await reportRoom(slug, room.name, "FREE"); if (result.error) return; setNote("FREE"); }}>Actually free</button>
          <button type="button" className="text-[12px] text-muted" onClick={async () => { const result = await reportRoom(slug, room.name, "LOCKED"); if (result.error) return; setNote("LOCKED"); }}>Locked</button>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
          <Clock className="h-4 w-4" /> {room.freeFrom} – {room.freeUntil}
        </p>
        <p className="mt-1 text-[12px] text-subtle">{room.nextBooking ? `Next: ${room.nextBooking}` : "No later booking"}</p>
      </div>
    </div>
  );
}
