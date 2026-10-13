/**
 * Bootstrap LAN built-in notebooks from seed/manifest.json and sync documents.
 * Look here when home notebooks are missing, legacy builtin-notebook ids linger,
 * or disk seed files aren't indexed into SQLite.
 */
import path from "path";
import { getDb } from "./db";
import { readSeedManifest, type SeedNotebook } from "./seed-manifest";
import { listSeedFilesOnDisk, syncNotebookFromSeedDir } from "./seed-sync";

let syncInFlight: Promise<void> | null = null;

const LEGACY_NOTEBOOK_ID = "builtin-notebook";
const LEGACY_TO_USEFUL_RESOURCES: Record<string, string> = {
  [LEGACY_NOTEBOOK_ID]: "useful-resources",
};

/** Rename legacy built-in notebook id/title to Useful Resources. */
function migrateLegacyNotebooks(db: ReturnType<typeof getDb>): void {
  for (const [oldId, newId] of Object.entries(LEGACY_TO_USEFUL_RESOURCES)) {
    const row = db
      .prepare(`SELECT id, title FROM notebooks WHERE id = ?`)
      .get(oldId) as { id: string; title: string } | undefined;
    if (!row) continue;

    const targetExists = db
      .prepare(`SELECT id FROM notebooks WHERE id = ?`)
      .get(newId);
    if (targetExists) continue;

    const manifest = readSeedManifest();
    const title =
      manifest?.find((n) => n.notebookId === newId)?.notebookTitle ??
      "Useful Resources";

    const legacy = db
      .prepare(
        `SELECT created_at, updated_at FROM notebooks WHERE id = ?`,
      )
      .get(oldId) as { created_at: string; updated_at: string };

    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(newId, title, legacy.created_at, legacy.updated_at);

    for (const table of ["sources", "chunks", "messages"] as const) {
      db.prepare(
        `UPDATE ${table} SET notebook_id = ? WHERE notebook_id = ?`,
      ).run(newId, oldId);
    }

    db.prepare(`DELETE FROM notebooks WHERE id = ?`).run(oldId);
    console.log(`[HawkChat] Migrated notebook ${oldId} → ${newId} (${title})`);
  }
}

function ensureNotebook(db: ReturnType<typeof getDb>, entry: SeedNotebook): void {
  const nb = db
    .prepare(`SELECT id, title FROM notebooks WHERE id = ?`)
    .get(entry.notebookId) as { id: string; title: string } | undefined;

  const now = new Date().toISOString();

  if (!nb) {
    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(entry.notebookId, entry.notebookTitle, now, now);
    console.log(`[HawkChat] Created notebook: ${entry.notebookTitle}`);
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

/** Create seed notebooks from manifest (no OpenAI required). */
export function ensureBuiltinNotebooks(): void {
  if (process.env.HAWKCHAT_AUTO_SEED !== "true") return;

  const notebooks = readSeedManifest();
  if (!notebooks?.length) return;

  const db = getDb();
  migrateLegacyNotebooks(db);

  for (const entry of notebooks) {
    ensureNotebook(db, entry);
  }
}

/** @deprecated alias */
export function ensureBuiltinNotebook(): void {
  ensureBuiltinNotebooks();
}

export function ensureBuiltinDocuments(): Promise<void> {
  if (process.env.HAWKCHAT_AUTO_SEED !== "true") {
    return Promise.resolve();
  }

  ensureBuiltinNotebooks();

  if (syncInFlight) return syncInFlight;
  syncInFlight = runAutoSeed().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
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

async function runAutoSeed(): Promise<void> {
  const notebooks = readSeedManifest();
  if (!notebooks?.length) return;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.warn(
      "[HawkChat] OPENAI_API_KEY missing — notebooks exist but PDFs are not indexed. Add your key and restart.",
    );
    return;
  }

  for (const entry of notebooks) {
    await seedNotebook(entry);
  }
}
