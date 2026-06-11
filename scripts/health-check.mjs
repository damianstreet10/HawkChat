import { createHash } from "crypto";
import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

await import("./ensure-sqlite.mjs");

const env = Object.fromEntries(
  readFileSync(path.join(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const Database = require("better-sqlite3");
const dbPath = path.join(root, "data", "hawkchat.db");
const db = new Database(dbPath);
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notebooks'").get()) {
  console.log("Database has no schema — start the app once (npm run dev:lan) to initialize.");
  db.close();
  process.exit(0);
}

const notebooks = db.prepare("SELECT COUNT(*) as n FROM notebooks").get().n;
const users = db.prepare("SELECT COUNT(*) as n FROM users").get().n;
console.log(`SQLite OK — ${notebooks} notebook(s), ${users} user(s)`);

const admins = env.HAWKCHAT_ADMINS?.trim();
if (admins) {
  const [email, token] = admins.split(":").map((s, i) =>
    i === 0 ? s.trim().toLowerCase() : s.trim(),
  );
  const row = db
    .prepare("SELECT token_hash FROM users WHERE email = ?")
    .get(email);
  const hash = createHash("sha256").update(token).digest("hex");
  console.log(
    row
      ? row.token_hash === hash
        ? "Admin credentials in .env match database"
        : "Admin email exists but token mismatch — restart app to sync from .env"
      : "Admin user not in DB yet — will be created on first API request",
  );
}

db.close();
