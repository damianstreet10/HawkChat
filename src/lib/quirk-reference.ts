import { randomBytes } from "crypto";
import type Database from "better-sqlite3";

export function generateQuirkReferenceId(): string {
  return `QK-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function allocateQuirkReferenceId(db: Database.Database): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const referenceId = generateQuirkReferenceId();
    const existing = db
      .prepare(`SELECT id FROM quirk_reports WHERE reference_id = ?`)
      .get(referenceId);
    if (!existing) return referenceId;
  }
  return `QK-${randomBytes(4).toString("hex").toUpperCase()}`;
}
