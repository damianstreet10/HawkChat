/**
 * GET /api/admin/events/notebook-templates/[templateId]/files — list template seed files.
 * POST — upload a seed file into the shared template folder.
 * DELETE — remove a template seed file (and re-sync notebooks).
 * Callers: global template file admin. Debug unknown templateId, templates
 * without seed dirs, or syncNotebookFromSeedDir after write/delete.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readSeedManifest } from "@/lib/seed-manifest";
import {
  isNotebookTemplateId,
  NOTEBOOK_TEMPLATE_LABELS,
  notebookTemplateHasSeedFiles,
} from "@/lib/notebook-templates";
import {
  deleteSeedFile,
  listFilesInSeedDir,
  resolveSeedDir,
  seedRelativePath,
  writeSeedFile,
} from "@/lib/seed-files";
import {
  removeSourcesByName,
  reindexSeedFileAtPath,
  syncNotebookFromSeedDir,
} from "@/lib/seed-sync";
import path from "path";

type Params = { params: { templateId: string } };

function manifestEntryForTemplate(templateId: string) {
  return readSeedManifest()?.find((entry) => entry.notebookId === templateId);
}

async function syncTemplateNotebook(templateId: string) {
  const entry = manifestEntryForTemplate(templateId);
  if (!entry) return;
  await syncNotebookFromSeedDir(entry.notebookId, entry.documentsDir, {
    label: entry.notebookTitle,
  });
}

/** Admin: list files in the shared seed folder for a notebook template. */
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

  await syncTemplateNotebook(params.templateId);

  return NextResponse.json({
    templateId: params.templateId,
    pickerLabel: NOTEBOOK_TEMPLATE_LABELS[params.templateId],
    seedPath: seedRelativePath(params.templateId),
    files: listFilesInSeedDir(params.templateId),
  });
}

/** Admin: upload a file into the template seed dir and reindex. */
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
    const entry = manifestEntryForTemplate(params.templateId);
    if (entry) {
      await reindexSeedFileAtPath(
        entry.notebookId,
        path.join(resolveSeedDir(params.templateId), filename),
        filename,
      );
    }
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

/** Admin: delete a template seed file and re-sync the template notebook. */
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
    const entry = manifestEntryForTemplate(params.templateId);
    if (entry) {
      removeSourcesByName(entry.notebookId, name);
    }
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
