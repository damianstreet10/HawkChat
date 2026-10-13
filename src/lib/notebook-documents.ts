/**
 * Filenames shown on notebook cards (prefer seed folder, else DB sources).
 * Look here when document lists are empty despite files on disk or in SQLite.
 */
import type Database from "better-sqlite3";
import { listSeedDocuments, type SeedNotebook } from "./seed-manifest";

/** PDF/document filenames shown on notebook cards (seed folder when available). */
export function getNotebookDocumentNames(
  db: Database.Database,
  notebookId: string,
  manifestEntry?: SeedNotebook,
): string[] {
  if (manifestEntry?.documentsDir) {
    const onDisk = listSeedDocuments(manifestEntry.documentsDir);
    if (onDisk.length > 0) {
      return onDisk;
    }
  }

  const rows = db
    .prepare(
      `SELECT name FROM sources
       WHERE notebook_id = ?
         AND lower(name) NOT LIKE '%readme%'
       ORDER BY name COLLATE NOCASE`,
    )
    .all(notebookId) as Array<{ name: string }>;

  return rows.map((r) => r.name);
}
