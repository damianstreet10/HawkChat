import type Database from "better-sqlite3";
import { listSeedDocuments, type SeedNotebook } from "./seed-manifest";

/** PDF/document filenames shown on notebook cards (indexed sources, else seed folder). */
export function getNotebookDocumentNames(
  db: Database.Database,
  notebookId: string,
  manifestEntry?: SeedNotebook,
): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sources
       WHERE notebook_id = ?
         AND lower(name) NOT LIKE '%readme%'
       ORDER BY name COLLATE NOCASE`,
    )
    .all(notebookId) as Array<{ name: string }>;

  if (rows.length > 0) {
    return rows.map((r) => r.name);
  }

  if (manifestEntry?.documentsDir) {
    return listSeedDocuments(manifestEntry.documentsDir);
  }

  return [];
}
