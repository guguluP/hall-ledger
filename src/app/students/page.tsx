"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Download,
  FileSpreadsheet,
  GitMerge,
  Loader2,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DigitPop } from "@/components/ui/digit-pop";
import { SuccessCheck } from "@/components/ui/success-check";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";
import {
  demoEnrollments,
  enrollmentsFrom,
  loadStudents,
  parseStudentGrid,
  proposeMerges,
  saveStudents,
  type SectionEnrollment,
  type StudentRow,
} from "@/lib/students";

function isSpreadsheet(file: File) {
  const n = file.name.toLowerCase();
  return [".xlsx", ".xlsm", ".xls", ".csv", ".tsv"].some((e) => n.endsWith(e));
}

export default function StudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [demo, setDemo] = useState(true);
  const { items, push } = useToastStack();

  useEffect(() => {
    const saved = loadStudents();
    if (saved?.length) {
      setRows(saved);
      setDemo(false);
      setStatus("ready");
    }
  }, []);

  const takeFile = useCallback((f: File | undefined) => {
    if (!f) return;
    if (!isSpreadsheet(f)) {
      setErrorMsg("Use .xlsx or .csv with Section, Roll, Name columns.");
      setStatus("error");
      return;
    }
    setFile(f);
    setErrorMsg("");
    setStatus("idle");
  }, []);

  const onDrop = useCallback(
    (accepted: File[], rejected: { file: File }[]) => {
      takeFile(accepted[0] || rejected[0]?.file);
    },
    [takeFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
  });

  const handleParse = async () => {
    if (!file) return;
    setStatus("parsing");
    setErrorMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", raw: false });
      const all: StudentRow[] = [];
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        if (!sheet) continue;
        const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
        all.push(...parseStudentGrid(grid));
      }
      if (!all.length) {
        throw new Error("No students found. Need a header row with Section plus Roll or Name.");
      }
      saveStudents(all);
      setRows(all);
      setDemo(false);
      setStatus("ready");
      push("Student list loaded", `${all.length} students across ${new Set(all.map((r) => r.section)).size} sections.`, "ok");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Could not read that file.");
      push("Parse failed", e instanceof Error ? e.message : "Error", "danger");
    }
  };

  const sections: SectionEnrollment[] = useMemo(() => {
    if (rows?.length) return enrollmentsFrom(rows);
    return demoEnrollments();
  }, [rows]);

  const total = sections.reduce((n, s) => n + s.count, 0);
  const merges = proposeMerges(sections);

  return (
    <AppShell
      title="Students"
      subtitle="Enrollment by section · merge proposals when a class shrinks"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Metric label="Sections" value={String(sections.length)} />
        <Metric label="Students" value={String(total)} />
        <Metric label="Merges" value={String(merges.length)} />
      </div>

      {demo && (
        <p className="mb-4 rounded-[20px] bg-elevated px-4 py-3 text-[13px] text-muted">
          Showing a 16-section sketch until you upload a list. D and E, N and O are small on purpose so merge cards appear.
        </p>
      )}

      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-[28px] border border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-elevated"
        }`}
      >
        <input {...getInputProps()} />
        <Users className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
        {file ? (
          <p className="text-[15px] font-semibold tracking-tight">{file.name}</p>
        ) : (
          <p className="text-[15px] text-muted">Drop a student list, or click to browse</p>
        )}
        <p className="mt-1 text-[12px] text-subtle">.xlsx · .csv · columns: Section, Roll, Name</p>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Button onClick={handleParse} disabled={!file || status === "parsing"}>
          {status === "parsing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />}
          {status === "parsing" ? "Reading…" : "Parse list"}
        </Button>
        <a href="/samples/students-template.csv" download>
          <Button variant="secondary">
            <Download className="h-4 w-4" strokeWidth={2.25} />
            CSV template
          </Button>
        </a>
      </div>

      {status === "ready" && !demo && (
        <div className="mb-6 flex items-center gap-3">
          <SuccessCheck show size={36} />
          <p className="text-[14px] text-muted">
            <span className="font-semibold text-fg">{total}</span> students loaded
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="mb-6 rounded-[20px] border border-[rgba(255,69,58,0.35)] bg-surface px-4 py-3 text-[14px] text-fg">
          {errorMsg}
        </p>
      )}

      {merges.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Consolidation</h2>
          <div className="space-y-2.5">
            {merges.map((m) => (
              <div
                key={`${m.from}-${m.into}`}
                className="flex flex-col gap-2 rounded-[28px] border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-accent" strokeWidth={2} />
                    <p className="text-[15px] font-semibold tracking-tight">
                      {m.from} → {m.into}
                    </p>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{m.reason}</p>
                </div>
                <p className="text-[13px] tabular-nums text-subtle">
                  {m.fromCount} + {m.intoCount} = {m.combined}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-[28px] border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold tracking-tight">By section</h2>
          <p className="mt-0.5 text-[13px] text-muted">Counts drive merge suggestions below 25 students</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                <th className="px-5 py-3">Section</th>
                <th className="px-5 py-3">Campus</th>
                <th className="px-5 py-3 text-right">Students</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.section} className="border-t border-border">
                  <td className="px-5 py-3 text-[14px] font-semibold tabular-nums">{s.section.replace("SECTION-", "")}</td>
                  <td className="px-5 py-3 text-[13px] text-muted">{s.campus}</td>
                  <td className={`px-5 py-3 text-right text-[14px] tabular-nums ${s.count < 25 ? "font-semibold text-warn" : "text-fg"}`}>
                    {s.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ToastStack items={items} />
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums tracking-tight text-fg">
        <DigitPop value={value} />
      </span>
    </div>
  );
}
