/**
 * Sync seed folder PDFs/txt/md into SQLite sources+chunks (add/update/remove).
 * Look here when documents on disk don't appear in chat, or reindex leaves
 * stale chunks — compare listSeedFilesOnDisk vs sources by name.
 */
import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { getDb } from "./db";
import { ingestSource } from "./ingest";
import { extractTextFromFile } from "./parse-document";
import { mimeForSeedFilename } from "./seed-files";

const SUPPORTED_EXT = new Set(["pdf", "txt", "md", "markdown"]);

export type SeedSyncResult = {
  added: string[];
  removed: string[];
  updated: string[];
};

/** List supported seed docs in a directory (creates dir if missing). */
export function listSeedFilesOnDisk(docsDir: string): string[] {
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    return [];
  }

  return fs.readdirSync(docsDir).filter((f) => {
    const lower = f.toLowerCase();
    if (lower.startsWith(".") || lower.includes("readme")) return false;
    return SUPPORTED_EXT.has(f.split(".").pop()?.toLowerCase() ?? "");
  });
}

/** Source names already indexed for a notebook (from SQLite). */
export function indexedSourceNames(
  db: Database.Database,
  notebookId: string,
): Set<string> {
  const rows = db
    .prepare(
      `SELECT name FROM sources
       WHERE notebook_id = ?
         AND lower(name) NOT LIKE '%readme%'`,
    )
    .all(notebookId) as Array<{ name: string }>;

  return new Set(rows.map((row) => row.name));
}

/** Delete sources (and chunks) matching a filename in a notebook. */
export function removeSourcesByName(notebookId: string, name: string): void {
  const db = getDb();
  const sources = db
    .prepare(`SELECT id FROM sources WHERE notebook_id = ? AND name = ?`)
    .all(notebookId, name) as Array<{ id: string }>;

  if (sources.length === 0) return;

  const tx = db.transaction(() => {
    for (const source of sources) {
      db.prepare(`DELETE FROM chunks WHERE source_id = ?`).run(source.id);
      db.prepare(`DELETE FROM sources WHERE id = ?`).run(source.id);
    }
    db.prepare(`UPDATE notebooks SET updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      notebookId,
    );
  });
  tx();
}

function sourceIndexedAt(
  db: Database.Database,
  notebookId: string,
  filename: string,
): number | null {
  const row = db
    .prepare(
      `SELECT created_at FROM sources
       WHERE notebook_id = ? AND name = ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(notebookId, filename) as { created_at: string } | undefined;

  return row ? Date.parse(row.created_at) : null;
}

async function indexSeedFile(
  notebookId: string,
  filePath: string,
  filename: string,
): Promise<void> {
  removeSourcesByName(notebookId, filename);

  const buffer = fs.readFileSync(filePath);
  const mime = mimeForSeedFilename(filename);
  const text = await extractTextFromFile(buffer, mime, filename);
  const result = await ingestSource(notebookId, filename, mime, text);
  console.log(`[HawkChat]   ${filename} → ${result.chunkCount} chunks`);
}

// --- Sync ---

/** Keep the notebook index aligned with files on disk. */
export async function syncNotebookFromSeedDir(
  notebookId: string,
  documentsDir: string,
  options?: { label?: string },
): Promise<SeedSyncResult> {
  const db = getDb();
  const docsDir = path.join(process.cwd(), "seed", documentsDir);
  const files = listSeedFilesOnDisk(docsDir);
  const onDisk = new Set(files);
  const indexed = indexedSourceNames(db, notebookId);
  const label = options?.label ?? notebookId;

  const removed: string[] = [];
  for (const name of indexed) {
    if (!onDisk.has(name)) {
      removeSourcesByName(notebookId, name);
      removed.push(name);
    }
  }

  const added: string[] = [];
  const updated: string[] = [];

  for (const filename of files) {
    const filePath = path.join(docsDir, filename);
    const indexedAt = sourceIndexedAt(db, notebookId, filename);
    const modifiedAt = fs.statSync(filePath).mtimeMs;
    const isNew = indexedAt === null;
    const isUpdated = indexedAt !== null && modifiedAt > indexedAt;

    if (!isNew && !isUpdated) continue;

    if (isNew) added.push(filename);
    else updated.push(filename);
  }

  if (added.length + updated.length > 0) {
    console.log(
      `[HawkChat] Syncing ${added.length + updated.length} document(s) into "${label}"…`,
    );
    for (const filename of [...added, ...updated]) {
      await indexSeedFile(
        notebookId,
        path.join(docsDir, filename),
        filename,
      );
    }
  }

  if (removed.length > 0) {
    console.log(
      `[HawkChat] Removed ${removed.length} stale document(s) from "${label}": ${removed.join(", ")}`,
    );
  }

  return { added, removed, updated };
}

/** Force re-ingest of one seed file path into the notebook. */
export async function reindexSeedFileAtPath(
  notebookId: string,
  filePath: string,
  filename: string,
): Promise<void> {
  await indexSeedFile(notebookId, filePath, filename);
}
