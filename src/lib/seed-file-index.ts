import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { ingestSource } from "./ingest";
import { extractTextFromFile } from "./parse-document";
import {
  deleteSeedFile,
  listFilesInSeedDir,
  mimeForSeedFilename,
  resolveSeedDir,
  writeSeedFile,
} from "./seed-files";

function removeSourcesByName(notebookId: string, name: string): void {
  const db = getDb();
  const sources = db
    .prepare(`SELECT id FROM sources WHERE notebook_id = ? AND name = ?`)
    .all(notebookId, name) as Array<{ id: string }>;

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

export async function indexNotebookSeedFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
): Promise<{ chunkCount: number }> {
  const filePath = path.join(resolveSeedDir(relativeDocumentsDir), filename);
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found on disk.");
  }

  removeSourcesByName(notebookId, filename);

  const buffer = fs.readFileSync(filePath);
  const mime = mimeForSeedFilename(filename);
  const text = await extractTextFromFile(buffer, mime, filename);
  const result = await ingestSource(notebookId, filename, mime, text);
  return { chunkCount: result.chunkCount };
}

export async function uploadAndIndexNotebookFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
  buffer: Buffer,
): Promise<{ filename: string; chunkCount: number }> {
  const safeName = writeSeedFile(relativeDocumentsDir, filename, buffer);
  const { chunkCount } = await indexNotebookSeedFile(
    notebookId,
    relativeDocumentsDir,
    safeName,
  );
  return { filename: safeName, chunkCount };
}

export function deleteNotebookSeedFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
): void {
  deleteSeedFile(relativeDocumentsDir, filename);
  removeSourcesByName(notebookId, filename);
}

export function listNotebookSeedFiles(relativeDocumentsDir: string): string[] {
  return listFilesInSeedDir(relativeDocumentsDir);
}
