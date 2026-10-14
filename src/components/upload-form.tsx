"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";

type Draft = {
  versionId: string;
  summary: { totalSections: number; totalSlots: number; totalConflicts: number };
  warnings: string[];
  hardConflicts: { day: string; time: string; room: string; sections: string[] }[];
  fileName: string;
};

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )hl_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export function UploadForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const { items, push } = useToastStack();

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0];
    if (!next) return;
    if (!/\.(csv|tsv)$/i.test(next.name)) {
      setError("Excel: File → Save As → CSV UTF-8. One file per section, or the tabular template.");
      setStatus("error");
      return;
    }
    setFile(next);
    setDraft(null);
    setError("");
    setStatus("idle");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

  async function parse() {
    if (!file) return;
    setStatus("working");
    setError("");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/i/${slug}/uploads`, {
      method: "POST",
      body,
      headers: { "x-csrf-token": csrfToken() },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Parse failed");
      setStatus("error");
      return;
    }
    setDraft(data);
    setStatus("ready");
    push("Draft ready", `${data.summary.totalSlots} slots, ${data.summary.totalConflicts} conflicts.`, data.summary.totalConflicts ? "danger" : "ok");
  }

  async function publish() {
    if (!draft) return;
    setStatus("working");
    setError("");
    try {
      const res = await fetch(`/api/i/${slug}/versions/${draft.versionId}/publish`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken() },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Publish failed");
        setStatus("error");
        return;
      }
      router.push(`/${slug}/timetable`);
      router.refresh();
    } catch {
      setError("Publish failed");
      setStatus("error");
    }
  }

  return (
    <>
      <p className="mb-4 max-w-xl text-[14px] text-muted">
        Excel: File → Save As → CSV UTF-8. Use one file per section, or the tabular template with a Section column.
        Templates: <a className="underline" href="/samples/tabular-template.csv">tabular</a>, <a className="underline" href="/samples/timetable-template.csv">grid</a>.
      </p>
      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-[28px] border border-dashed px-6 py-12 text-center ${isDragActive ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
      >
        <input {...getInputProps()} aria-label="Timetable CSV" />
        <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-muted" />
        <p className="text-[15px] font-medium">{file ? file.name : "Drop a .csv or .tsv file"}</p>
      </div>
      {error && <p className="mb-4 text-[14px] text-danger">{error}</p>}
      <div className="mb-8 flex gap-2">
        <Button type="button" onClick={() => void parse()} disabled={!file || status === "working"}>
          {status === "working" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Review draft
        </Button>
        <Button type="button" variant="secondary" onClick={() => void publish()} disabled={!draft || status === "working"}>
          Publish
        </Button>
      </div>
      {draft && (
        <section className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Slots" value={draft.summary.totalSlots} />
            <Stat label="Sections" value={draft.summary.totalSections} />
            <Stat label="Conflicts" value={draft.summary.totalConflicts} />
          </div>
          {draft.hardConflicts.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="mb-2 flex items-center gap-2 text-[14px] font-semibold"><AlertTriangle className="h-4 w-4 text-warn" /> Room overlaps</p>
              <ul className="space-y-1 text-[13px] text-muted">
                {draft.hardConflicts.slice(0, 12).map((conflict) => (
                  <li key={`${conflict.room}-${conflict.day}-${conflict.time}-${conflict.sections.join()}`}>
                    {conflict.room} · {conflict.day} {conflict.time} · {conflict.sections.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft.warnings.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-[13px] text-muted">
              <p className="mb-2 flex items-center gap-2 font-semibold text-fg"><CheckCircle2 className="h-4 w-4" /> Warnings</p>
              <ul className="space-y-1">
                {draft.warnings.slice(0, 12).map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
      <ToastStack items={items} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[24px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}
