/**
 * GET /api/admin/events/[slug]/seed-files — list per-notebook seed folders/files.
 * Callers: event seed file admin (non–World Cup). Debug missing manifest,
 * WC redirect error, or kit-quirks notebooks filtered out of the list.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { readEventManifest } from "@/lib/event-manifest";
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
import { isWorldCupEvent } from "@/lib/world-cup-constants";

type Params = { params: { slug: string } };

/** Admin: overview of event seed dirs/files (not for World Cup). */
export async function GET(request: Request, { params }: Params) {
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

  const manifest = readEventManifest(params.slug);
  if (!manifest) {
    return NextResponse.json({ error: "Event manifest not found." }, { status: 404 });
  }

  const notebooks = manifest.notebooks
    .filter((entry) => {
      const folderKey =
        entry.documentsDir.split("/").pop() ?? entry.documentsDir;
      if (
        folderKey === "kit-quirks" ||
        entry.notebookId.endsWith("-kit-quirks")
      ) {
        return false;
      }
      if (isNotebookTemplateId(folderKey)) {
        return notebookTemplateHasSeedFiles(folderKey);
      }
      return true;
    })
    .map((entry) => {
    const folderKey =
      entry.documentsDir.split("/").pop() ?? entry.documentsDir;
    const templateId = isNotebookTemplateId(folderKey) ? folderKey : null;

    return {
      notebookId: entry.notebookId,
      notebookTitle: entry.notebookTitle,
      documentsDir: entry.documentsDir,
      seedPath: seedRelativePath(entry.documentsDir),
      templateId,
      pickerLabel: templateId ? NOTEBOOK_TEMPLATE_LABELS[templateId] : null,
      files: listFilesInSeedDir(entry.documentsDir),
    };
  });

  return NextResponse.json({
    slug: params.slug,
    title: manifest.eventTitle,
    notebooks,
  });
}
