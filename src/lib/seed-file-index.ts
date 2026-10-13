/**
 * Admin helpers: write/delete/list seed files and trigger reindex for a notebook.
 * Look here when uploading a seed file succeeds on disk but chat still misses it.
 */
import path from "path";
import {
  reindexSeedFileAtPath,
  removeSourcesByName,
} from "./seed-sync";
import {
  deleteSeedFile,
  listFilesInSeedDir,
  resolveSeedDir,
  writeSeedFile,
} from "./seed-files";

/** Reindex one file already under the notebook's seed documents dir. */
export async function indexNotebookSeedFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
): Promise<{ chunkCount: number }> {
  const filePath = path.join(resolveSeedDir(relativeDocumentsDir), filename);
  await reindexSeedFileAtPath(notebookId, filePath, filename);
  return { chunkCount: 0 };
}

/** Write buffer to the seed dir, then reindex that file into the notebook. */
export async function uploadAndIndexNotebookFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
  buffer: Buffer,
): Promise<{ filename: string; chunkCount: number }> {
  const safeName = writeSeedFile(relativeDocumentsDir, filename, buffer);
  await indexNotebookSeedFile(notebookId, relativeDocumentsDir, safeName);
  return { filename: safeName, chunkCount: 0 };
}

/** Delete a seed file and remove its indexed sources/chunks. */
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

export { removeSourcesByName };
