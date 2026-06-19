import path from "path";
import { getDb } from "./db";
import { readEventManifest } from "./event-manifest";
import { isWorldCupEvent } from "./world-cup-event";
import { ensureBuiltinDocuments } from "./auto-seed";
import type { SeedNotebook } from "./seed-manifest";
import { listSeedFilesOnDisk, syncNotebookFromSeedDir } from "./seed-sync";

const seedingByEvent = new Map<string, Promise<void>>();

function ensureNotebook(entry: SeedNotebook): void {
  const db = getDb();
  const nb = db
    .prepare(`SELECT id, title FROM notebooks WHERE id = ?`)
    .get(entry.notebookId) as { id: string; title: string } | undefined;

  const now = new Date().toISOString();

  if (!nb) {
    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(entry.notebookId, entry.notebookTitle, now, now);
    console.log(`[HawkChat] Created event notebook: ${entry.notebookTitle}`);
    return;
  }

  if (nb.title !== entry.notebookTitle) {
    db.prepare(`UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?`).run(
      entry.notebookTitle,
      now,
      entry.notebookId,
    );
  }
}

async function seedNotebook(entry: SeedNotebook): Promise<void> {
  const db = getDb();
  const docsDir = path.join(process.cwd(), "seed", entry.documentsDir);

  db.prepare(
    `DELETE FROM sources
     WHERE notebook_id = ? AND lower(name) LIKE '%readme%'`,
  ).run(entry.notebookId);

  const files = listSeedFilesOnDisk(docsDir);
  if (files.length === 0) {
    console.warn(
      `[HawkChat] No documents in seed/${entry.documentsDir}/ — add PDFs for "${entry.notebookTitle}".`,
    );
    return;
  }

  await syncNotebookFromSeedDir(entry.notebookId, entry.documentsDir, {
    label: entry.notebookTitle,
  });
}

export function ensureEventNotebooks(eventSlug: string): void {
  const manifest = readEventManifest(eventSlug);
  if (!manifest?.notebooks.length) return;

  for (const entry of manifest.notebooks) {
    ensureNotebook(entry);
  }
}

export function ensureEventDocuments(eventSlug: string): Promise<void> {
  if (isWorldCupEvent(eventSlug)) {
    return ensureBuiltinDocuments();
  }

  if (process.env.HAWKCHAT_AUTO_SEED !== "true") {
    return Promise.resolve();
  }

  ensureEventNotebooks(eventSlug);

  let pending = seedingByEvent.get(eventSlug);
  if (!pending) {
    pending = runEventSeed(eventSlug).finally(() => {
      seedingByEvent.delete(eventSlug);
    });
    seedingByEvent.set(eventSlug, pending);
  }
  return pending;
}

async function runEventSeed(eventSlug: string): Promise<void> {
  const manifest = readEventManifest(eventSlug);
  if (!manifest?.notebooks.length) return;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.warn(
      `[HawkChat] OPENAI_API_KEY missing — event "${eventSlug}" notebooks exist but PDFs are not indexed.`,
    );
    return;
  }

  for (const entry of manifest.notebooks) {
    await seedNotebook(entry);
  }
}
