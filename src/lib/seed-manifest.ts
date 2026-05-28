import fs from "fs";
import path from "path";

export type SeedNotebook = {
  notebookId: string;
  notebookTitle: string;
  documentsDir: string;
  description?: string;
};

type LegacyManifest = {
  notebookId: string;
  notebookTitle: string;
  documentsDir: string;
};

type ManifestV2 = {
  notebooks: SeedNotebook[];
};

export function readSeedManifest(): SeedNotebook[] | null {
  const manifestPath = path.join(process.cwd(), "seed", "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as
    | ManifestV2
    | LegacyManifest;

  if ("notebooks" in raw && Array.isArray(raw.notebooks)) {
    return raw.notebooks;
  }

  const legacy = raw as LegacyManifest;
  if (legacy.notebookId && legacy.documentsDir) {
    return [
      {
        notebookId: legacy.notebookId,
        notebookTitle: legacy.notebookTitle,
        documentsDir: legacy.documentsDir,
      },
    ];
  }

  return null;
}
