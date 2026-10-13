/**
 * SQLite singleton (better-sqlite3): schema bootstrap, env seeding, shared row types.
 * Look here for DB path issues (HAWKCHAT_DB_DIR), missing tables, or admin/event
 * rows not appearing after startup — seeding runs inside getDb().
 */
import Database from "better-sqlite3";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { runMigrations } from "./db-migrate";
import { listEventSlugsFromDisk, readEventManifest } from "./event-manifest";
import { hashPassword } from "./passwords";

const DATA_DIR = process.env.HAWKCHAT_DB_DIR
  ? path.resolve(process.env.HAWKCHAT_DB_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "hawkchat.db");

let db: Database.Database | null = null;

/** Open (or reuse) hawkchat.db; creates core tables, migrates, then seeds from env/disk. */
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

// --- Env / disk seeding (skipped when HAWKCHAT_SEED_BUILD=true) ---

/** Upsert admins from HAWKCHAT_ADMINS / HAWKCHAT_ADMIN_EMAIL(+TOKEN). */
function seedAdminFromEnv(database: Database.Database): void {
  const entries: Array<{ email: string; token: string }> = [];

  const multi = process.env.HAWKCHAT_ADMINS?.trim();
  if (multi) {
    for (const part of multi.split(",")) {
      const bit = part.trim();
      if (!bit) continue;
      const colon = bit.indexOf(":");
      const email = (
        colon === -1 ? bit : bit.slice(0, colon)
      )
        .trim()
        .toLowerCase();
      const token =
        colon === -1
          ? `email-only:${email}`
          : bit.slice(colon + 1).trim() || `email-only:${email}`;
      if (email.includes("@")) entries.push({ email, token });
    }
  }

  const singleEmail = process.env.HAWKCHAT_ADMIN_EMAIL?.trim().toLowerCase();
  const singleToken = process.env.HAWKCHAT_ADMIN_TOKEN?.trim();
  if (singleEmail) {
    entries.push({
      email: singleEmail,
      token: singleToken || `email-only:${singleEmail}`,
    });
  }

  /** Login password for env-listed super admins (never commit — keep in .env only). */
  const adminPassword = process.env.HAWKCHAT_ADMIN_PASSWORD;
  const passwordHash =
    typeof adminPassword === "string" && adminPassword.length > 0
      ? hashPassword(adminPassword)
      : null;

  const now = new Date().toISOString();
  for (const { email, token } of entries) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const existing = database
      .prepare(`SELECT id, token_hash, role FROM users WHERE email = ?`)
      .get(email) as
      | { id: string; token_hash: string; role: string }
      | undefined;

    if (existing) {
      if (existing.token_hash !== tokenHash) {
        database
          .prepare(`UPDATE users SET token_hash = ? WHERE id = ?`)
          .run(tokenHash, existing.id);
      }
      if (existing.role !== "admin") {
        database
          .prepare(`UPDATE users SET role = 'admin' WHERE id = ?`)
          .run(existing.id);
      }
      if (passwordHash) {
        database
          .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
          .run(passwordHash, existing.id);
      }
      continue;
    }

    database
      .prepare(
        `INSERT INTO users (id, email, name, role, token_hash, created_at, password_hash)
         VALUES (?, ?, ?, 'admin', ?, ?, ?)`,
      )
      .run(
        uuidv4(),
        email,
        email.split("@")[0] ?? "Admin",
        tokenHash,
        now,
        passwordHash,
      );
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
 * Event-only users (viewer role) — slug:email or slug:email:token pairs.
 * Example: champions-league:test@hawkeyeinnovations.com
 * Token is optional (email-only sign-in); if omitted a stable placeholder is used.
 */
function seedEventUsersFromEnv(database: Database.Database): void {
  const raw = process.env.HAWKCHAT_EVENT_USERS?.trim();
  if (!raw) return;

  const now = new Date().toISOString();
  const byEmail = new Map<string, { token: string; slugs: Set<string> }>();

  for (const entry of raw.split(",")) {
    const part = entry.trim();
    if (!part) continue;
    const firstColon = part.indexOf(":");
    if (firstColon === -1) continue;

    const slug = part.slice(0, firstColon).trim();
    const rest = part.slice(firstColon + 1).trim();
    const secondColon = rest.indexOf(":");
    const email =
      secondColon === -1
        ? rest.toLowerCase()
        : rest.slice(0, secondColon).trim().toLowerCase();
    const token =
      secondColon === -1
        ? `email-only:${email}`
        : rest.slice(secondColon + 1).trim() || `email-only:${email}`;
    if (!slug || !email || !email.includes("@")) continue;

    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, { token, slugs: new Set([slug]) });
    } else {
      existing.token = token;
      existing.slugs.add(slug);
    }
  }

  for (const [email, spec] of byEmail) {
    const tokenHash = createHash("sha256").update(spec.token).digest("hex");
    let user = database
      .prepare(`SELECT id, token_hash, role FROM users WHERE email = ?`)
      .get(email) as
      | { id: string; token_hash: string; role: string }
      | undefined;

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
      user = { id: userId, token_hash: tokenHash, role: "viewer" };
    } else if (user.token_hash !== tokenHash) {
      database
        .prepare(`UPDATE users SET token_hash = ? WHERE id = ?`)
        .run(tokenHash, user.id);
    }

    const eventIds: string[] = [];
    for (const slug of spec.slugs) {
      const event = database
        .prepare(`SELECT id FROM events WHERE slug = ?`)
        .get(slug) as { id: string } | undefined;
      if (!event) continue;
      eventIds.push(event.id);

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

    if (user.role !== "viewer") continue;

    if (eventIds.length === 0) {
      database
        .prepare(`DELETE FROM event_members WHERE user_id = ?`)
        .run(user.id);
      continue;
    }

    const placeholders = eventIds.map(() => "?").join(", ");
    database
      .prepare(
        `DELETE FROM event_members
         WHERE user_id = ?
           AND event_id NOT IN (${placeholders})`,
      )
      .run(user.id, ...eventIds);
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

// --- Row types ---

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
