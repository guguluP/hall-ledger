"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Loader2, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ToastStack, useToastStack } from "@/components/ui/toast-stack";

export default function StudentsUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const { items, push } = useToastStack();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      setStatus("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    await new Promise((r) => setTimeout(r, 600));
    setStatus("done");
    push("Student list received", file.name, "ok");
  };

  return (
    <AppShell title="Student lists" subtitle="Enrollment for consolidation proposals">
      <div
        {...getRootProps()}
        className={`mb-6 cursor-pointer rounded-[28px] border border-dashed px-6 py-12 text-center transition-colors ${
          isDragActive ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-elevated"
        }`}
      >
        <input {...getInputProps()} />
        <Users className="mx-auto mb-3 h-10 w-10 text-subtle" strokeWidth={1.5} />
        {file ? (
          <p className="text-[15px] font-semibold tracking-tight">{file.name}</p>
        ) : (
          <p className="text-[15px] text-muted">Drop a student list spreadsheet, or click to browse</p>
        )}
        <p className="mt-1 text-[12px] text-subtle">.xlsx · .csv</p>
      </div>

      <Button onClick={handleUpload} disabled={!file || status === "uploading"}>
        {status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" strokeWidth={2.25} />}
        {status === "uploading" ? "Uploading…" : "Upload list"}
      </Button>

      <ToastStack items={items} />
    </AppShell>
  );
}
