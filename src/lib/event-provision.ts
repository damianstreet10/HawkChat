/**
 * Create/update event seed trees and manifests from shared templates + custom notebooks.
 * Look here when provisioning fails, custom notebook folders/ids collide, or
 * seed/events/{slug} doesn't match what the admin UI selected.
 */
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
import { listSeedDocuments, readSeedManifest, type SeedNotebook } from "./seed-manifest";

export type NotebookTemplateInfo = {
  id: NotebookTemplateId;
  title: string;
  description: string;
  sourceDir: string;
  files: string[];
  fileCount: number;
};

export type CustomNotebookInput = {
  title: string;
  description?: string;
  /** Client-side key so uploads can be matched after create. */
  clientKey?: string;
};

export type ProvisionedCustomNotebook = {
  clientKey?: string;
  notebookId: string;
  title: string;
};

// --- Templates ---

/** Shared LAN template notebooks available when creating an event. */
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

/** Folder / id suffix from a custom notebook title. */
export function slugifyNotebookFolder(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "custom";
}

function uniqueFolderKey(base: string, used: Set<string>): string {
  let key = base;
  let n = 2;
  while (used.has(key) || isNotebookTemplateId(key)) {
    key = `${base}-${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}

function parseCustomNotebooks(raw: unknown): CustomNotebookInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomNotebookInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const title =
      typeof (item as { title?: unknown }).title === "string"
        ? (item as { title: string }).title.trim()
        : "";
    if (!title) continue;
    const description =
      typeof (item as { description?: unknown }).description === "string"
        ? (item as { description: string }).description.trim()
        : "";
    const clientKey =
      typeof (item as { clientKey?: unknown }).clientKey === "string"
        ? (item as { clientKey: string }).clientKey.trim()
        : undefined;
    out.push({
      title,
      description: description || undefined,
      clientKey: clientKey || undefined,
    });
  }
  return out;
}

export { parseCustomNotebooks };

// --- Provision ---

/** Write event seed tree + manifest from templates and optional custom notebooks. */
export function provisionEventNotebooks(
  eventSlug: string,
  eventTitle: string,
  eventDescription: string,
  templateIds: string[],
  customNotebooks: CustomNotebookInput[] = [],
): {
  manifest: EventManifest;
  notebooks: string[];
  copiedFiles: number;
  customNotebooks: ProvisionedCustomNotebook[];
} {
  const manifest = readSeedManifest() ?? [];
  const byId = new Map(manifest.map((entry) => [entry.notebookId, entry]));

  const selected = templateIds.filter(isNotebookTemplateId);
  const customs = customNotebooks.filter((n) => n.title.trim());

  if (selected.length === 0 && customs.length === 0) {
    throw new Error(
      "Select at least one notebook template or add a custom notebook.",
    );
  }

  const usedFolders = new Set<string>();
  const notebooks: SeedNotebook[] = [];
  const provisionedCustoms: ProvisionedCustomNotebook[] = [];
  let copiedFiles = 0;

  for (const templateId of selected) {
    const template = byId.get(templateId);
    const copied = copyTemplateDocuments(templateId, eventSlug);
    copiedFiles += copied.length;
    usedFolders.add(templateId);
    notebooks.push({
      notebookId: `${eventSlug}-${templateId}`,
      notebookTitle:
        template?.notebookTitle ?? templateId.replace(/-/g, " "),
      documentsDir: `events/${eventSlug}/${templateId}`,
      description: template?.description,
    });
  }

  for (const custom of customs) {
    const folder = uniqueFolderKey(
      slugifyNotebookFolder(custom.title),
      usedFolders,
    );
    const destDir = path.join(eventSeedRoot(eventSlug), folder);
    fs.mkdirSync(destDir, { recursive: true });
    const notebookId = `${eventSlug}-${folder}`;
    notebooks.push({
      notebookId,
      notebookTitle: custom.title.trim(),
      documentsDir: `events/${eventSlug}/${folder}`,
      description: custom.description?.trim() || undefined,
    });
    provisionedCustoms.push({
      clientKey: custom.clientKey,
      notebookId,
      title: custom.title.trim(),
    });
  }

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

  return {
    manifest: eventManifest,
    notebooks: notebooks.map((n) => n.notebookTitle),
    copiedFiles,
    customNotebooks: provisionedCustoms,
  };
}

/**
 * Append a custom notebook to an existing event (empty folder; add docs via Manage files).
 */
export function addCustomNotebookToEvent(
  eventSlug: string,
  custom: CustomNotebookInput,
): SeedNotebook {
  const title = custom.title.trim();
  if (!title) throw new Error("Notebook title is required.");

  const existing = fs.existsSync(eventManifestPath(eventSlug))
    ? JSON.parse(fs.readFileSync(eventManifestPath(eventSlug), "utf-8")) as EventManifest
    : null;
  if (!existing?.notebooks) {
    throw new Error("Event manifest not found.");
  }

  const usedFolders = new Set(
    existing.notebooks.map((n) => {
      const parts = n.documentsDir.split("/");
      return parts[parts.length - 1] ?? "";
    }),
  );
  for (const n of existing.notebooks) {
    const suffix = n.notebookId.startsWith(`${eventSlug}-`)
      ? n.notebookId.slice(eventSlug.length + 1)
      : n.notebookId;
    usedFolders.add(suffix);
  }

  const folder = uniqueFolderKey(slugifyNotebookFolder(title), usedFolders);
  const destDir = path.join(eventSeedRoot(eventSlug), folder);
  fs.mkdirSync(destDir, { recursive: true });

  const notebook: SeedNotebook = {
    notebookId: `${eventSlug}-${folder}`,
    notebookTitle: title,
    documentsDir: `events/${eventSlug}/${folder}`,
    description: custom.description?.trim() || undefined,
  };

  existing.notebooks.push(notebook);
  fs.writeFileSync(
    eventManifestPath(eventSlug),
    `${JSON.stringify(existing, null, 2)}\n`,
    "utf-8",
  );

  ensureEventNotebooks(eventSlug);
  return notebook;
}
