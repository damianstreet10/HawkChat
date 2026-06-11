/**
 * Re-index PDFs from seed/* folders into data/hawkchat.db.
 * Usage: npx tsx scripts/reindex-seed.ts
 */
import { readFileSync, rmSync, existsSync } from "fs";
import path from "path";
import { ensureBuiltinDocuments } from "../src/lib/auto-seed";
import { closeDb, getDb } from "../src/lib/db";

const root = process.cwd();
const envPath = path.join(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    if (!process.env[key]) {
      process.env[key] = line.slice(i + 1).trim();
    }
  }
}

process.env.HAWKCHAT_AUTO_SEED = "true";

async function main() {
  for (const file of ["hawkchat.db", "hawkchat.db-wal", "hawkchat.db-shm"]) {
    const p = path.join(root, "data", file);
    if (existsSync(p)) rmSync(p);
  }

  await ensureBuiltinDocuments();

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.title, COUNT(s.id) as source_count
       FROM notebooks n
       LEFT JOIN sources s ON s.notebook_id = n.id
         AND lower(s.name) NOT LIKE '%readme%'
       GROUP BY n.id
       ORDER BY n.title`,
    )
    .all() as Array<{ title: string; source_count: number }>;

  for (const row of rows) {
    console.log(`${row.title}: ${row.source_count} source(s)`);
  }

  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
