import type Database from "better-sqlite3";

export function runMigrations(database: Database.Database): void {
  migrateMessageClientColumns(database);
  migrateMessageGuestLabel(database);
  migrateQuirkReports(database);
  migrateUserMonitorRole(database);
}

function migrateQuirkReports(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS quirk_reports (
      id TEXT PRIMARY KEY,
      reporter_name TEXT,
      kit_name TEXT NOT NULL,
      asset_tag TEXT,
      quirk_details TEXT NOT NULL,
      extra_notes TEXT,
      client_ip TEXT,
      client_session_id TEXT,
      guest_label TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quirk_reports_created ON quirk_reports(created_at);
  `);
}

function migrateMessageGuestLabel(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(messages)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "guest_label")) {
    database.exec(`ALTER TABLE messages ADD COLUMN guest_label TEXT`);
  }
}

function migrateMessageClientColumns(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(messages)`)
    .all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("client_session_id")) {
    database.exec(
      `ALTER TABLE messages ADD COLUMN client_session_id TEXT`,
    );
    database.exec(`ALTER TABLE messages ADD COLUMN client_ip TEXT`);
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_messages_client_session ON messages(client_session_id)`,
    );
  }
}

function migrateUserMonitorRole(database: Database.Database): void {
  const row = database
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`)
    .get() as { sql: string } | undefined;
  if (!row?.sql || row.sql.includes("'monitor'")) return;

  database.exec(`
    CREATE TABLE users_migrated (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'contributor', 'admin', 'monitor')),
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    INSERT INTO users_migrated SELECT * FROM users;
    DROP TABLE users;
    ALTER TABLE users_migrated RENAME TO users;
  `);
}
