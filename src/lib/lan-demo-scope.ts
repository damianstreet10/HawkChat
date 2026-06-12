import { readSeedManifest } from "./seed-manifest";

/** Notebook IDs for the open LAN / World Cup demo (main seed manifest). */
export function getLanDemoNotebookIds(): string[] {
  const manifest = readSeedManifest();
  return manifest?.map((n) => n.notebookId) ?? [];
}
