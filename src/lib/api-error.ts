import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/http-error";
import { zodFields } from "@/lib/schemas";

const UPLOAD_MAX = 1_048_576;
const JSON_MAX = 100_000;

export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, ...(error.fields ? { fields: error.fields } : {}) },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid input", fields: zodFields(error) }, { status: 400 });
  }
  console.error("[api]", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export function assertUploadLength(req: Request) {
  const raw = req.headers.get("content-length");
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isFinite(length)) throw new HttpError(400, "Invalid content length");
  if (length > UPLOAD_MAX + 16_384) throw new HttpError(413, "Upload is too large");
}

export function assertFileSize(size: number) {
  if (size > UPLOAD_MAX) throw new HttpError(413, "Upload is too large");
}

export function assertBodyLimit(req: Request, max = JSON_MAX) {
  const raw = req.headers.get("content-length");
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isFinite(length)) throw new HttpError(400, "Invalid content length");
  if (length > max) throw new HttpError(413, "Request is too large");
}

export function assertJsonContent(req: Request) {
  const type = req.headers.get("content-type");
  if (!type) return;
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Unsupported content type");
  }
}

export function assertMultipart(req: Request) {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("multipart/form-data")) {
    throw new HttpError(415, "Unsupported content type");
  }
}
