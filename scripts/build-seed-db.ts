/**
 * Build a pre-indexed SQLite database from seed document folders in manifest.json.
 * Run once before App Store builds (requires OPENAI_API_KEY).
 *
 *   npm run build:seed
 */
import fs from "fs";
import path from "path";
import { readSeedManifest } from "../src/lib/seed-manifest";
import { closeDb, getDb } from "../src/lib/db";
import { ingestSource } from "../src/lib/ingest";
import { extractTextFromFile } from "../src/lib/parse-document";

const ROOT = path.join(process.cwd(), "seed");
const OUTPUT_DIR = path.join(ROOT, "output");

const SUPPORTED_EXT = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
]);

function listFiles(docsDir: string): string[] {
  if (!fs.existsSync(docsDir)) return [];
  return fs.readdirSync(docsDir).filter((f) => {
    const lower = f.toLowerCase();
    if (lower.startsWith(".") || lower.includes("readme")) return false;
    const ext = f.split(".").pop()?.toLowerCase() ?? "";
    return SUPPORTED_EXT.has(ext);
  });
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required to embed documents.");
    process.exit(1);
  }

  const notebooks = readSeedManifest();
  if (!notebooks?.length) {
    console.error("seed/manifest.json must list at least one notebook.");
    process.exit(1);
  }

  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  process.env.HAWKCHAT_DB_DIR = OUTPUT_DIR;
  process.env.HAWKCHAT_SEED_BUILD = "true";

  const db = getDb();
  const now = new Date().toISOString();
  let totalFiles = 0;

  for (const entry of notebooks) {
    const docsDir = path.join(ROOT, entry.documentsDir);
    const files = listFiles(docsDir);
    totalFiles += files.length;

    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(entry.notebookId, entry.notebookTitle, now, now);

    console.log(`\nNotebook: ${entry.notebookTitle} (${entry.notebookId})`);

    if (files.length === 0) {
      console.log(`  (no documents in seed/${entry.documentsDir}/)`);
      continue;
    }

    console.log(`  Indexing ${files.length} file(s)…`);

    for (const filename of files) {
      const filePath = path.join(docsDir, filename);
      const buffer = fs.readFileSync(filePath);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const mime =
        ext === "pdf"
          ? "application/pdf"
          : ext === "md" || ext === "markdown"
            ? "text/markdown"
            : "text/plain";

      process.stdout.write(`    ${filename} … `);
      const text = await extractTextFromFile(buffer, mime, filename);
      const result = await ingestSource(
        entry.notebookId,
        filename,
        mime,
        text,
      );
      console.log(`${result.chunkCount} chunks`);
    }
  }

  closeDb();

  if (totalFiles === 0) {
    console.error("\nNo documents found in any seed/*/ folder.");
    process.exit(1);
  }

  const dbFile = path.join(OUTPUT_DIR, "hawkchat.db");
  const stats = fs.statSync(dbFile);
  console.log(
    `\nDone: ${dbFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
  );
  console.log(
    "Bundle this file in your iOS/Android app (see docs/APP_STORE.md).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
