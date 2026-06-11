import Database from "better-sqlite3";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { runMigrations } from "./db-migrate";

const DATA_DIR = process.env.HAWKCHAT_DB_DIR
  ? path.resolve(process.env.HAWKCHAT_DB_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "hawkchat.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'contributor', 'admin', 'monitor')),
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      content_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      notebook_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sources_notebook ON sources(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_notebook ON chunks(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_messages_notebook ON messages(notebook_id);
  `);

  runMigrations(db);

  if (process.env.HAWKCHAT_SEED_BUILD !== "true") {
    seedAdminFromEnv(db);
    seedMonitorsFromEnv(db);
  }

  return db;
}

/** Close DB so seed build scripts can write a fresh file. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function seedAdminFromEnv(database: Database.Database): void {
  const entries: Array<{ email: string; token: string }> = [];

  const multi = process.env.HAWKCHAT_ADMINS?.trim();
  if (multi) {
    for (const part of multi.split(",")) {
      const bit = part.trim();
      if (!bit) continue;
      const colon = bit.indexOf(":");
      if (colon === -1) continue;
      const email = bit.slice(0, colon).trim().toLowerCase();
      const token = bit.slice(colon + 1).trim();
      if (email && token) entries.push({ email, token });
    }
  }

  const singleEmail = process.env.HAWKCHAT_ADMIN_EMAIL?.trim().toLowerCase();
  const singleToken = process.env.HAWKCHAT_ADMIN_TOKEN?.trim();
  if (singleEmail && singleToken) {
    entries.push({ email: singleEmail, token: singleToken });
  }

  const now = new Date().toISOString();
  for (const { email, token } of entries) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const existing = database
      .prepare(`SELECT id, token_hash FROM users WHERE email = ?`)
      .get(email) as { id: string; token_hash: string } | undefined;

    if (existing) {
      if (existing.token_hash !== tokenHash) {
        database
          .prepare(`UPDATE users SET token_hash = ? WHERE id = ?`)
          .run(tokenHash, existing.id);
      }
      continue;
    }

    database
      .prepare(
        `INSERT INTO users (id, email, name, role, token_hash, created_at)
         VALUES (?, ?, ?, 'admin', ?, ?)`,
      )
      .run(uuidv4(), email, email.split("@")[0] ?? "Admin", tokenHash, now);
  }
}

/** Pre-approved monitor accounts (email:token pairs, comma-separated). */
function seedMonitorsFromEnv(database: Database.Database): void {
  const raw = process.env.HAWKCHAT_MONITORS?.trim();
  if (!raw) return;

  const now = new Date().toISOString();

  for (const entry of raw.split(",")) {
    const part = entry.trim();
    if (!part) continue;
    const colon = part.indexOf(":");
    if (colon === -1) continue;

    const email = part.slice(0, colon).trim().toLowerCase();
    const token = part.slice(colon + 1).trim();
    if (!email || !token) continue;

    const existing = database
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existing) continue;

    const tokenHash = createHash("sha256").update(token).digest("hex");
    database
      .prepare(
        `INSERT INTO users (id, email, name, role, token_hash, created_at)
         VALUES (?, ?, ?, 'monitor', ?, ?)`,
      )
      .run(uuidv4(), email, "Monitor", tokenHash, now);
  }
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: "viewer" | "contributor" | "admin" | "monitor";
  created_at: string;
};

export type Notebook = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Source = {
  id: string;
  notebook_id: string;
  name: string;
  type: string;
  content_text: string;
  created_at: string;
};

export type Chunk = {
  id: string;
  source_id: string;
  notebook_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
};

export type Message = {
  id: string;
  notebook_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
};

export type Citation = {
  sourceId: string;
  sourceName: string;
  excerpt: string;
  chunkIndex: number;
};
