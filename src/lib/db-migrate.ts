import type Database from "better-sqlite3";
import { inferQuirkCategory } from "./quirk-auto-category";
import { allocateQuirkReferenceId } from "./quirk-reference";

export function runMigrations(database: Database.Database): void {
  migrateMessageClientColumns(database);
  migrateMessageGuestLabel(database);
  migrateQuirkReports(database);
  migrateQuirkReportStatus(database);
  migrateQuirkReporterEmail(database);
  migrateQuirkReportExtras(database);
  migrateQuirkCategorySource(database);
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

function migrateQuirkReportStatus(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(quirk_reports)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "status")) {
    database.exec(
      `ALTER TABLE quirk_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'new'`,
    );
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_quirk_reports_status ON quirk_reports(status)`,
    );
  }
}

function migrateQuirkReporterEmail(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(quirk_reports)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "reporter_email")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN reporter_email TEXT`);
  }
}

function migrateQuirkReportExtras(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(quirk_reports)`)
    .all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("reference_id")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN reference_id TEXT`);
    database.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_quirk_reports_reference ON quirk_reports(reference_id)`,
    );
  }
  if (!names.has("resolution_notes")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN resolution_notes TEXT`);
  }
  if (!names.has("category")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN category TEXT`);
    database.exec(
      `CREATE INDEX IF NOT EXISTS idx_quirk_reports_category ON quirk_reports(category)`,
    );
  }
  if (!names.has("resolved_at")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN resolved_at TEXT`);
  }
  if (!names.has("resolved_by")) {
    database.exec(`ALTER TABLE quirk_reports ADD COLUMN resolved_by TEXT`);
  }

  const missing = database
    .prepare(
      `SELECT id FROM quirk_reports WHERE reference_id IS NULL OR reference_id = ''`,
    )
    .all() as Array<{ id: string }>;
  const update = database.prepare(
    `UPDATE quirk_reports SET reference_id = ? WHERE id = ?`,
  );
  for (const row of missing) {
    update.run(allocateQuirkReferenceId(database), row.id);
  }
}

function migrateQuirkCategorySource(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(quirk_reports)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "category_source")) {
    database.exec(
      `ALTER TABLE quirk_reports ADD COLUMN category_source TEXT NOT NULL DEFAULT 'auto'`,
    );
  }

  const untagged = database
    .prepare(
      `SELECT id, kit_name, asset_tag, quirk_details, extra_notes
       FROM quirk_reports
       WHERE category IS NULL OR category = ''`,
    )
    .all() as Array<{
    id: string;
    kit_name: string;
    asset_tag: string | null;
    quirk_details: string;
    extra_notes: string | null;
  }>;

  const update = database.prepare(
    `UPDATE quirk_reports SET category = ?, category_source = 'auto' WHERE id = ?`,
  );

  for (const row of untagged) {
    const category = inferQuirkCategory({
      kitName: row.kit_name,
      assetTag: row.asset_tag,
      quirkDetails: row.quirk_details,
      extraNotes: row.extra_notes,
    });
    update.run(category, row.id);
  }
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
