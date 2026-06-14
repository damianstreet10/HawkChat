import fs from "fs";
import path from "path";
import {
  isNotebookTemplateId,
  NOTEBOOK_TEMPLATE_IDS,
  type NotebookTemplateId,
} from "./notebook-templates";
import {
  eventManifestPath,
  eventSeedRoot,
  type EventManifest,
} from "./event-manifest";
import { ensureEventDocuments, ensureEventNotebooks } from "./event-seed";
import { listSeedDocuments, readSeedManifest } from "./seed-manifest";

export type NotebookTemplateInfo = {
  id: NotebookTemplateId;
  title: string;
  description: string;
  sourceDir: string;
  files: string[];
  fileCount: number;
};

export function listNotebookTemplates(): NotebookTemplateInfo[] {
  const manifest = readSeedManifest() ?? [];
  const byId = new Map(manifest.map((entry) => [entry.notebookId, entry]));

  return NOTEBOOK_TEMPLATE_IDS.map((id) => {
    const entry = byId.get(id);
    const files = listSeedDocuments(id);
    return {
      id,
      title: entry?.notebookTitle ?? id,
      description: entry?.description ?? "",
      sourceDir: `seed/${id}/`,
      files,
      fileCount: files.length,
    };
  });
}

function copyTemplateDocuments(
  templateId: NotebookTemplateId,
  eventSlug: string,
): string[] {
  const destDir = path.join(eventSeedRoot(eventSlug), templateId);
  fs.mkdirSync(destDir, { recursive: true });

  const copied: string[] = [];
  for (const filename of listSeedDocuments(templateId)) {
    const src = path.join(process.cwd(), "seed", templateId, filename);
    const dest = path.join(destDir, filename);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, dest);
    copied.push(filename);
  }
  return copied;
}

export function provisionEventNotebooks(
  eventSlug: string,
  eventTitle: string,
  eventDescription: string,
  templateIds: string[],
): { manifest: EventManifest; notebooks: string[]; copiedFiles: number } {
  const manifest = readSeedManifest() ?? [];
  const byId = new Map(manifest.map((entry) => [entry.notebookId, entry]));

  const selected = templateIds.filter(isNotebookTemplateId);
  if (selected.length === 0) {
    throw new Error("Select at least one notebook template.");
  }

  const notebooks = selected.map((templateId) => {
    const template = byId.get(templateId);
    copyTemplateDocuments(templateId, eventSlug);
    return {
      notebookId: `${eventSlug}-${templateId}`,
      notebookTitle:
        template?.notebookTitle ?? templateId.replace(/-/g, " "),
      documentsDir: `events/${eventSlug}/${templateId}`,
      description: template?.description,
    };
  });

  const eventManifest: EventManifest = {
    eventTitle,
    eventDescription: eventDescription || undefined,
    notebooks,
  };

  fs.mkdirSync(eventSeedRoot(eventSlug), { recursive: true });
  fs.writeFileSync(
    eventManifestPath(eventSlug),
    `${JSON.stringify(eventManifest, null, 2)}\n`,
    "utf-8",
  );

  ensureEventNotebooks(eventSlug);
  void ensureEventDocuments(eventSlug);

  const copiedFiles = selected.reduce(
    (sum, templateId) => sum + listSeedDocuments(templateId).length,
    0,
  );

  return {
    manifest: eventManifest,
    notebooks: notebooks.map((n) => n.notebookTitle),
    copiedFiles,
  };
}
