import { readFileSync, existsSync } from "fs";
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
  await ensureBuiltinDocuments();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT name FROM sources WHERE notebook_id = 'useful-resources' ORDER BY name`,
    )
    .all() as Array<{ name: string }>;
  console.log("Indexed useful-resources:");
  for (const row of rows) {
    console.log(" -", row.name);
  }
  closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
