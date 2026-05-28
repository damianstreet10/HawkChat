import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth, requireUpload } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ingestSource } from "@/lib/ingest";
import { extractTextFromFile } from "@/lib/parse-document";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
  const db = getDb();
  const sources = db
    .prepare(
      `SELECT id, notebook_id, name, type, created_at,
        LENGTH(content_text) as char_count
       FROM sources WHERE notebook_id = ?
       ORDER BY created_at ASC`,
    )
    .all(params.id);
  return NextResponse.json(sources);
}

export async function POST(request: Request, { params }: Params) {
  try {
    requireUpload(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  const notebook = db
    .prepare(`SELECT id FROM notebooks WHERE id = ?`)
    .get(params.id);
  if (!notebook) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const pastedText = formData.get("text") as string | null;
  const pastedName = (formData.get("name") as string | null) ?? "Pasted text";

  try {
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractTextFromFile(
        buffer,
        file.type,
        file.name,
      );
      const result = await ingestSource(
        params.id,
        file.name,
        file.type || "file",
        text,
      );
      return NextResponse.json({
        ok: true,
        name: file.name,
        ...result,
      });
    }

    if (pastedText && pastedText.trim()) {
      const result = await ingestSource(
        params.id,
        pastedName,
        "text/plain",
        pastedText.trim(),
      );
      return NextResponse.json({
        ok: true,
        name: pastedName,
        ...result,
      });
    }

    return NextResponse.json(
      { error: "Provide a file or pasted text" },
      { status: 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
