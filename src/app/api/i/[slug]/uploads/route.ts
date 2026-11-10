import { NextResponse } from "next/server";
import { apiError, assertFileSize, assertMultipart, assertUploadLength } from "@/lib/api-error";
import { requireRole } from "@/lib/auth/authz";
import { assertMutation } from "@/lib/auth/csrf";
import { xlsxToCsv } from "@/lib/parse/xlsx";
import { createDraft } from "@/lib/timetable-repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    assertMutation(req);
    assertMultipart(req);
    assertUploadLength(req);
    const { slug } = await ctx.params;
    const { user, inst } = await requireRole(slug, "EDITOR");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const name = file.name || "timetable.csv";
    if (!/\.(csv|tsv|xlsx)$/i.test(name)) {
      return NextResponse.json({ error: "Upload a .csv, .tsv, or .xlsx file." }, { status: 400 });
    }
    assertFileSize(file.size);
    let bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.xlsx$/i.test(name)) bytes = new TextEncoder().encode(xlsxToCsv(bytes));
    const draft = await createDraft({
      institutionId: inst.id,
      userId: user.id,
      fileName: name,
      bytes,
    });
    return NextResponse.json(draft);
  } catch (error) {
    return apiError(error);
  }
}
