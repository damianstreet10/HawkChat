import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { ingestSource } from "./ingest";
import { extractTextFromFile } from "./parse-document";
import { readSeedManifest, type SeedNotebook } from "./seed-manifest";

const SUPPORTED_EXT = new Set(["pdf", "txt", "md", "markdown"]);

let seeding: Promise<void> | null = null;

const LEGACY_NOTEBOOK_ID = "builtin-notebook";
const LEGACY_TO_USEFUL_RESOURCES: Record<string, string> = {
  [LEGACY_NOTEBOOK_ID]: "useful-resources",
};

/** Rename legacy built-in notebook id/title to Useful Resources. */
function migrateLegacyNotebooks(db: ReturnType<typeof getDb>): void {
  for (const [oldId, newId] of Object.entries(LEGACY_TO_USEFUL_RESOURCES)) {
    const row = db
      .prepare(`SELECT id, title FROM notebooks WHERE id = ?`)
      .get(oldId) as { id: string; title: string } | undefined;
    if (!row) continue;

    const targetExists = db
      .prepare(`SELECT id FROM notebooks WHERE id = ?`)
      .get(newId);
    if (targetExists) continue;

    const manifest = readSeedManifest();
    const title =
      manifest?.find((n) => n.notebookId === newId)?.notebookTitle ??
      "Useful Resources";

    const legacy = db
      .prepare(
        `SELECT created_at, updated_at FROM notebooks WHERE id = ?`,
      )
      .get(oldId) as { created_at: string; updated_at: string };

    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(newId, title, legacy.created_at, legacy.updated_at);

    for (const table of ["sources", "chunks", "messages"] as const) {
      db.prepare(
        `UPDATE ${table} SET notebook_id = ? WHERE notebook_id = ?`,
      ).run(newId, oldId);
    }

    db.prepare(`DELETE FROM notebooks WHERE id = ?`).run(oldId);
    console.log(`[HawkChat] Migrated notebook ${oldId} → ${newId} (${title})`);
  }
}

function ensureNotebook(db: ReturnType<typeof getDb>, entry: SeedNotebook): void {
  const nb = db
    .prepare(`SELECT id, title FROM notebooks WHERE id = ?`)
    .get(entry.notebookId) as { id: string; title: string } | undefined;

  const now = new Date().toISOString();

  if (!nb) {
    db.prepare(
      `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    ).run(entry.notebookId, entry.notebookTitle, now, now);
    console.log(`[HawkChat] Created notebook: ${entry.notebookTitle}`);
    return;
  }

  if (nb.title !== entry.notebookTitle) {
    db.prepare(`UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?`).run(
      entry.notebookTitle,
      now,
      entry.notebookId,
    );
  }
}

/** Create seed notebooks from manifest (no OpenAI required). */
export function ensureBuiltinNotebooks(): void {
  if (process.env.HAWKCHAT_AUTO_SEED !== "true") return;

  const notebooks = readSeedManifest();
  if (!notebooks?.length) return;

  const db = getDb();
  migrateLegacyNotebooks(db);

  for (const entry of notebooks) {
    ensureNotebook(db, entry);
  }
}

/** @deprecated alias */
export function ensureBuiltinNotebook(): void {
  ensureBuiltinNotebooks();
}

export function ensureBuiltinDocuments(): Promise<void> {
  if (process.env.HAWKCHAT_AUTO_SEED !== "true") {
    return Promise.resolve();
  }

  ensureBuiltinNotebooks();

  if (!seeding) seeding = runAutoSeed();
  return seeding;
}

function listSeedFiles(docsDir: string): string[] {
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
    return [];
  }

  return fs.readdirSync(docsDir).filter((f) => {
    const lower = f.toLowerCase();
    if (lower.startsWith(".") || lower.includes("readme")) return false;
    return SUPPORTED_EXT.has(f.split(".").pop()?.toLowerCase() ?? "");
  });
}

async function seedNotebook(entry: SeedNotebook): Promise<void> {
  const db = getDb();
  const docsDir = path.join(process.cwd(), "seed", entry.documentsDir);

  db.prepare(
    `DELETE FROM sources
     WHERE notebook_id = ? AND lower(name) LIKE '%readme%'`,
  ).run(entry.notebookId);

  const existing = db
    .prepare(
      `SELECT COUNT(*) as c FROM sources
       WHERE notebook_id = ? AND lower(name) NOT LIKE '%readme%'`,
    )
    .get(entry.notebookId) as { c: number };

  if (existing.c > 0) return;

  const files = listSeedFiles(docsDir);
  if (files.length === 0) {
    console.warn(
      `[HawkChat] No documents in seed/${entry.documentsDir}/ — add PDFs for "${entry.notebookTitle}".`,
    );
    return;
  }

  console.log(
    `[HawkChat] Indexing ${files.length} document(s) into "${entry.notebookTitle}"…`,
  );

  for (const filename of files) {
    const filePath = path.join(docsDir, filename);
    const buffer = fs.readFileSync(filePath);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "pdf" ? "application/pdf" : "text/plain";
    const text = await extractTextFromFile(buffer, mime, filename);
    const result = await ingestSource(
      entry.notebookId,
      filename,
      mime,
      text,
    );
    console.log(`[HawkChat]   ${filename} → ${result.chunkCount} chunks`);
  }
}

async function runAutoSeed(): Promise<void> {
  const notebooks = readSeedManifest();
  if (!notebooks?.length) return;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.warn(
      "[HawkChat] OPENAI_API_KEY missing — notebooks exist but PDFs are not indexed. Add your key and restart.",
    );
    return;
  }

  for (const entry of notebooks) {
    await seedNotebook(entry);
  }
}
