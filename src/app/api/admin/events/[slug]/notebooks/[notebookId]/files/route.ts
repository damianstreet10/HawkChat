import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readEventManifest } from "@/lib/event-manifest";
import {
  deleteNotebookSeedFile,
  listNotebookSeedFiles,
  uploadAndIndexNotebookFile,
} from "@/lib/seed-file-index";
import { seedRelativePath } from "@/lib/seed-files";
import { isWorldCupEvent } from "@/lib/world-cup-constants";

type Params = { params: { slug: string; notebookId: string } };

function getNotebookEntry(slug: string, notebookId: string) {
  const manifest = readEventManifest(slug);
  if (!manifest) return null;
  return manifest.notebooks.find((entry) => entry.notebookId === notebookId) ?? null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const entry = getNotebookEntry(params.slug, params.notebookId);
  if (!entry) {
    return NextResponse.json({ error: "Notebook not found." }, { status: 404 });
  }

  if (entry.notebookId.endsWith("-kit-quirks")) {
    return NextResponse.json(
      { error: "Kit Quirks does not use document files." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    notebookId: entry.notebookId,
    notebookTitle: entry.notebookTitle,
    seedPath: seedRelativePath(entry.documentsDir),
    files: listNotebookSeedFiles(entry.documentsDir),
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  if (isWorldCupEvent(params.slug)) {
    return NextResponse.json(
      { error: "Manage World Cup documents from the main seed/ folders." },
      { status: 400 },
    );
  }

  const entry = getNotebookEntry(params.slug, params.notebookId);
  if (!entry) {
    return NextResponse.json({ error: "Notebook not found." }, { status: 404 });
  }

  if (entry.notebookId.endsWith("-kit-quirks")) {
    return NextResponse.json(
      { error: "Kit Quirks does not use document files." },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAndIndexNotebookFile(
      entry.notebookId,
      entry.documentsDir,
      file.name,
      buffer,
    );
    return NextResponse.json({
      ok: true,
      ...result,
      files: listNotebookSeedFiles(entry.documentsDir),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  if (isWorldCupEvent(params.slug)) {
    return NextResponse.json(
      { error: "Manage World Cup documents from the main seed/ folders." },
      { status: 400 },
    );
  }

  const entry = getNotebookEntry(params.slug, params.notebookId);
  if (!entry) {
    return NextResponse.json({ error: "Notebook not found." }, { status: 404 });
  }

  if (entry.notebookId.endsWith("-kit-quirks")) {
    return NextResponse.json(
      { error: "Kit Quirks does not use document files." },
      { status: 400 },
    );
  }

  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "File name required." }, { status: 400 });
  }

  try {
    deleteNotebookSeedFile(entry.notebookId, entry.documentsDir, name);
    return NextResponse.json({
      ok: true,
      files: listNotebookSeedFiles(entry.documentsDir),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 400 },
    );
  }
}
