"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { SuccessCheck } from "@/components/ui/success-check";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";
import { saveClientPublished } from "@/lib/client-cache";

type ParseSummary = { totalSections: number; totalSlots: number; totalConflicts: number };

function isSpreadsheet(file: File) {
  const n = file.name.toLowerCase();
  return [".xlsx", ".xlsm", ".xls", ".csv", ".tsv", ".ods"].some((e) => n.endsWith(e));
}

export default function TimetableUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "ready" | "publishing" | "published" | "error">("idle");
  const [summary, setSummary] = useState<ParseSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsePayload, setParsePayload] = useState<any>(null);
  const [fileName, setFileName] = useState("");
  const { items, push } = useToastStack();

  const takeFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isSpreadsheet(f)) {
      setErrorMsg("Only .xlsx, .xlsm, .xls, .csv, .tsv or .ods files are supported");
      setStatus("error");
      return;
    }
    setFile(f);
    setFileName(f.name);
    setStatus("idle");
    setSummary(null);
    setParsePayload(null);
    setErrorMsg("");
    setWarnings([]);
  }, []);

  const onDrop = useCallback((accepted: File[], rejected: { file: File }[]) => {
    takeFile(accepted[0] || rejected[0]?.file);
  }, [takeFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, maxFiles: 1 });

  const handleParse = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMsg("");
    setWarnings([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/timetable/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Parse failed");
      setParsePayload(data);
      setFileName(data.fileName || file.name);
      setSummary(data.parse?.summary || {
        totalSections: data.parse?.sections?.length ?? 0,
        totalSlots: data.parse?.allSlots?.length ?? 0,
        totalConflicts: data.parse?.hardConflicts?.length ?? 0,
      });
      if (Array.isArray(data.parse?.warnings)) setWarnings(data.parse.warnings);
      setStatus("ready");
      push(
        "Timetable parsed",
        `${data.parse?.summary?.totalSections ?? "—"} sections · ${data.parse?.summary?.totalSlots ?? "—"} slots`,
        "ok",
      );
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
      push("Upload failed", e instanceof Error ? e.message : "Error", "danger");
    }
  };

  const handlePublish = async () => {
    if (!parsePayload) return;
    setStatus("publishing");
    try {
      const res = await fetch("/api/timetable/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parse: parsePayload.parse, fileName: fileName || parsePayload.fileName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Publish failed");
      if (data.payload) saveClientPublished(data.payload);
      setStatus("published");
      push("Published", data.message || "Timetable is live.", "ok");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Publish failed");
      push("Publish failed", e instanceof Error ? e.message : "Error", "danger");
    }
  };

  const busy = status === "processing" || status === "publishing";

  return (
    <AppShell title="Upload timetable" subtitle="Replace the 2025–26 seed · Excel, CSV or ODS">
      <section className="mb-6 rounded-[28px] border border-border bg-surface px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-tight">Expected layout</h2>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-muted">
          <li>One sheet per section (SEC_A … SEC_P) <em>or</em> a single grid with days as rows.</li>
          <li>Time headers like <span className="tabular-nums text-fg">9.30AM–10.30AM</span> — 12-hour or 24-hour both work.</li>
          <li>Room can live in the header (<span className="text-fg">Room No:- 316</span>) or in a cell (<span className="text-fg">R.No-404</span>).</li>
          <li>The 2025–26 first-year workbook is already live. Upload only to replace it.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/samples/timetable-template.csv" download>
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              CSV template
            </Button>
          </a>
          <a href="/samples/revised-1st-year-timetable-2025-26.xlsx" download>
            <Button variant="ghost" size="sm">
              <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
              2025–26 sample Excel
            </Button>
          </a>
        </div>
      </section>

      <div
        {...getRootProps()}
        className={`mb-6 cursor-pointer rounded-[28px] border border-dashed px-6 py-12 text-center transition-colors ${
          isDragActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-elevated"
        }`}
      >
        <input {...getInputProps()} disabled={busy} />
        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
        {file ? (
          <p className="text-[15px] font-semibold tracking-tight text-fg">{file.name}</p>
        ) : (
          <p className="text-[15px] text-muted">Drop a timetable workbook here, or click to browse</p>
        )}
        <p className="mt-1 text-[12px] text-subtle">.xlsx · .xlsm · .xls · .csv · .tsv · .ods</p>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Button onClick={handleParse} disabled={!file || busy}>
          {status === "processing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={2.25} />
          )}
          {status === "processing" ? "Parsing…" : "Parse file"}
        </Button>
        <Button variant="secondary" onClick={handlePublish} disabled={busy || (status !== "ready" && status !== "published")}>
          {status === "publishing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
          )}
          {status === "publishing" ? "Publishing…" : "Publish"}
        </Button>
        <Link href="/timetable">
          <Button variant="ghost">View grid</Button>
        </Link>
      </div>

      {status === "processing" && (
        <p className="mb-6 text-[13px] text-muted">
          <span className="t-shimmer" data-text="Reading sheets and matching rooms…">
            Reading sheets and matching rooms…
          </span>
        </p>
      )}
      {status === "publishing" && (
        <p className="mb-6 text-[13px] text-muted">
          <span className="t-shimmer" data-text="Writing the live grid…">
            Writing the live grid…
          </span>
        </p>
      )}

      {status === "published" && (
        <div className="mb-6 flex items-center gap-3">
          <SuccessCheck show size={40} />
          <div>
            <p className="text-[15px] font-semibold">Published</p>
            <p className="text-[13px] text-muted">Grid and vacancy search now use this timetable.</p>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-[rgba(255,69,58,0.35)] bg-surface px-5 py-4" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[14px] text-fg">{errorMsg}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-[28px] border border-border bg-surface px-5 py-4">
          <p className="text-[13px] font-semibold text-muted">Notes</p>
          <ul className="mt-1 space-y-1 text-[13px] text-subtle">
            {warnings.slice(0, 6).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {summary && (
        <div className="grid grid-cols-3 gap-2.5 sm:max-w-md">
          <div className="rounded-[28px] border border-border bg-surface px-4 py-3 text-center">
            <p className="text-[12px] font-medium text-muted">Sections</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-fg">{summary.totalSections}</p>
          </div>
          <div className="rounded-[28px] border border-border bg-surface px-4 py-3 text-center">
            <p className="text-[12px] font-medium text-muted">Slots</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-fg">{summary.totalSlots}</p>
          </div>
          <div className="rounded-[28px] border border-border bg-surface px-4 py-3 text-center">
            <p className="text-[12px] font-medium text-muted">Conflicts</p>
            <p className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${summary.totalConflicts === 0 ? "text-ok" : "text-fg"}`}>
              {summary.totalConflicts}
            </p>
          </div>
        </div>
      )}
      <ToastStack items={items} />
    </AppShell>
  );
}
