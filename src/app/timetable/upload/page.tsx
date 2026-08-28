"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
      return;
    }
    setFile(f); setFileName(f.name); setStatus("idle"); setSummary(null);
    setParsePayload(null); setErrorMsg(""); setWarnings([]);
  }, []);

  const onDrop = useCallback((accepted: File[], rejected: { file: File }[]) => {
    takeFile(accepted[0] || rejected[0]?.file);
  }, [takeFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, maxFiles: 1 });

  const handleParse = async () => {
    if (!file) return;
    setStatus("processing"); setErrorMsg(""); setWarnings([]);
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
      push("Timetable parsed", `${data.parse?.summary?.totalSections ?? "—"} sections · ${data.parse?.summary?.totalSlots ?? "—"} slots`, "ok");
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

  return (
    <AppShell title="Upload timetable" subtitle="Excel, CSV or ODS · any layout with days and times">
      <div {...getRootProps()} className={`mb-6 cursor-pointer rounded-[28px] border border-dashed px-6 py-12 text-center transition-colors ${isDragActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-elevated"}`}>
        <input {...getInputProps()} />
        <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
        {file ? <p className="text-[15px] font-semibold tracking-tight text-fg">{file.name}</p> : <p className="text-[15px] text-muted">Drop a timetable workbook here, or click to browse</p>}
        <p className="mt-1 text-[12px] text-subtle">.xlsx · .xlsm · .xls · .csv · .tsv · .ods</p>
      </div>
      <div className="mb-8 flex flex-wrap gap-3">
        <Button onClick={handleParse} disabled={!file || status === "processing" || status === "publishing"}>
          {status === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={2.25} />}
          {status === "processing" ? "Parsing…" : "Parse file"}
        </Button>
        <Button variant="secondary" onClick={handlePublish} disabled={status !== "ready" && status !== "published"}>
          {status === "publishing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
          Publish
        </Button>
        <Link href="/timetable"><Button variant="ghost">View grid</Button></Link>
      </div>
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
        <div className="mb-6 flex items-start gap-3 rounded-[28px] border border-[rgba(255,69,58,0.35)] bg-surface px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[14px] text-fg">{errorMsg}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mb-6 rounded-[28px] border border-border bg-surface px-5 py-4">
          <p className="text-[13px] font-semibold text-muted">Notes</p>
          <ul className="mt-1 space-y-1 text-[13px] text-subtle">
            {warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}
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
            <p className={`mt-1 text-[22px] font-semibold tabular-nums tracking-tight ${summary.totalConflicts === 0 ? "text-ok" : "text-fg"}`}>{summary.totalConflicts}</p>
          </div>
        </div>
      )}
      <ToastStack items={items} />
    </AppShell>
  );
}
