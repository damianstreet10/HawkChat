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

export async function indexNotebookSeedFile(
  notebookId: string,
  relativeDocumentsDir: string,
  filename: string,
): Promise<{ chunkCount: number }> {
  const filePath = path.join(resolveSeedDir(relativeDocumentsDir), filename);
  await reindexSeedFileAtPath(notebookId, filePath, filename);
  return { chunkCount: 0 };
}

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
