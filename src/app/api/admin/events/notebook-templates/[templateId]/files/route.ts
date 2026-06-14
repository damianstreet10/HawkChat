import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import {
  isNotebookTemplateId,
  NOTEBOOK_TEMPLATE_LABELS,
  notebookTemplateHasSeedFiles,
} from "@/lib/notebook-templates";
import {
  deleteSeedFile,
  listFilesInSeedDir,
  seedRelativePath,
  writeSeedFile,
} from "@/lib/seed-files";

type Params = { params: { templateId: string } };

export async function GET(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  if (!isNotebookTemplateId(params.templateId)) {
    return NextResponse.json({ error: "Unknown notebook template." }, { status: 404 });
  }

  if (!notebookTemplateHasSeedFiles(params.templateId)) {
    return NextResponse.json(
      { error: "This notebook does not use document files." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    templateId: params.templateId,
    pickerLabel: NOTEBOOK_TEMPLATE_LABELS[params.templateId],
    seedPath: seedRelativePath(params.templateId),
    files: listFilesInSeedDir(params.templateId),
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

  if (!isNotebookTemplateId(params.templateId)) {
    return NextResponse.json({ error: "Unknown notebook template." }, { status: 404 });
  }

  if (!notebookTemplateHasSeedFiles(params.templateId)) {
    return NextResponse.json(
      { error: "This notebook does not use document files." },
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
    const filename = writeSeedFile(params.templateId, file.name, buffer);
    return NextResponse.json({
      ok: true,
      filename,
      files: listFilesInSeedDir(params.templateId),
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

  if (!isNotebookTemplateId(params.templateId)) {
    return NextResponse.json({ error: "Unknown notebook template." }, { status: 404 });
  }

  if (!notebookTemplateHasSeedFiles(params.templateId)) {
    return NextResponse.json(
      { error: "This notebook does not use document files." },
      { status: 400 },
    );
  }

  const name = new URL(request.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "File name required." }, { status: 400 });
  }

  try {
    deleteSeedFile(params.templateId, name);
    return NextResponse.json({
      ok: true,
      files: listFilesInSeedDir(params.templateId),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed." },
      { status: 400 },
    );
  }
}
