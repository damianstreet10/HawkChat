/**
 * Notebook IDs for the open LAN / World Cup demo (main seed/manifest.json).
 * Look here when guest LAN access includes/excludes the wrong notebooks.
 */
import { readSeedManifest } from "./seed-manifest";

/** Notebook IDs for the open LAN / World Cup demo (main seed manifest). */
export function getLanDemoNotebookIds(): string[] {
  const manifest = readSeedManifest();
  return manifest?.map((n) => n.notebookId) ?? [];
}
