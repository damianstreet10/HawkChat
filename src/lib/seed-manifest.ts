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

const SEED_DOC_EXT = new Set([".pdf", ".txt", ".md", ".markdown"]);

/** Files in seed/{documentsDir} before indexing (LAN demo preview). */
export function listSeedDocuments(documentsDir: string): string[] {
  const dir = path.join(process.cwd(), "seed", documentsDir);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => {
      const lower = file.toLowerCase();
      if (lower.includes("readme")) return false;
      return SEED_DOC_EXT.has(path.extname(lower));
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
