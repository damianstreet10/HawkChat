import Database from "better-sqlite3";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { runMigrations } from "./db-migrate";
import { listEventSlugsFromDisk, readEventManifest } from "./event-manifest";

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
    seedEventsFromDisk(db);
    seedEventUsersFromEnv(db);
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

/** Register events from seed/events/{slug}/manifest.json (does not touch LAN demo). */
function seedEventsFromDisk(database: Database.Database): void {
  const now = new Date().toISOString();

  for (const slug of listEventSlugsFromDisk()) {
    const manifest = readEventManifest(slug);
    if (!manifest) continue;

    const existing = database
      .prepare(`SELECT id FROM events WHERE slug = ?`)
      .get(slug) as { id: string } | undefined;

    if (existing) {
      database
        .prepare(`UPDATE events SET title = ?, description = ? WHERE id = ?`)
        .run(
          manifest.eventTitle,
          manifest.eventDescription ?? null,
          existing.id,
        );
      continue;
    }

    database
      .prepare(
        `INSERT INTO events (id, slug, title, description, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        slug,
        manifest.eventTitle,
        manifest.eventDescription ?? null,
        now,
      );
  }
}

/**
 * Event-only users (viewer role) — slug:email:token pairs, comma-separated.
 * Example: champions-league:test@hawkeyeinnovations.com:TEST
 */
function seedEventUsersFromEnv(database: Database.Database): void {
  const raw = process.env.HAWKCHAT_EVENT_USERS?.trim();
  if (!raw) return;

  const now = new Date().toISOString();

  for (const entry of raw.split(",")) {
    const part = entry.trim();
    if (!part) continue;
    const firstColon = part.indexOf(":");
    const secondColon = part.indexOf(":", firstColon + 1);
    if (firstColon === -1 || secondColon === -1) continue;

    const slug = part.slice(0, firstColon).trim();
    const email = part.slice(firstColon + 1, secondColon).trim().toLowerCase();
    const token = part.slice(secondColon + 1).trim();
    if (!slug || !email || !token) continue;

    const event = database
      .prepare(`SELECT id FROM events WHERE slug = ?`)
      .get(slug) as { id: string } | undefined;
    if (!event) continue;

    const tokenHash = createHash("sha256").update(token).digest("hex");
    let user = database
      .prepare(`SELECT id, token_hash FROM users WHERE email = ?`)
      .get(email) as { id: string; token_hash: string } | undefined;

    if (!user) {
      const userId = uuidv4();
      const local = email.split("@")[0] ?? "User";
      const name = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map(
          (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(),
        )
        .join(" ");

      database
        .prepare(
          `INSERT INTO users (id, email, name, role, token_hash, created_at)
           VALUES (?, ?, ?, 'viewer', ?, ?)`,
        )
        .run(userId, email, name || "User", tokenHash, now);
      user = { id: userId, token_hash: tokenHash };
    } else if (user.token_hash !== tokenHash) {
      database
        .prepare(`UPDATE users SET token_hash = ? WHERE id = ?`)
        .run(tokenHash, user.id);
    }

    const member = database
      .prepare(
        `SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ?`,
      )
      .get(event.id, user.id);
    if (!member) {
      database
        .prepare(
          `INSERT INTO event_members (event_id, user_id, created_at) VALUES (?, ?, ?)`,
        )
        .run(event.id, user.id, now);
    }
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
