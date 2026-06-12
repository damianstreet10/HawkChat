import type Database from "better-sqlite3";
import type { QuirkCategoryFilter } from "./quirk-category";
import type { QuirkStatusFilter } from "./quirk-status";

export const QUIRK_REPORT_COLUMNS = `
  id, reference_id, reporter_name, reporter_email, kit_name, asset_tag,
  quirk_details, extra_notes, resolution_notes, category, category_source,
  client_ip, client_session_id, guest_label, created_at, status,
  resolved_at, resolved_by, event_slug
`;

export type QuirkListParams = {
  status: QuirkStatusFilter;
  category: QuirkCategoryFilter;
  q: string;
  limit: number;
  /** Tournament slug — when set, only quirks for that event. */
  eventSlug?: string;
  /** LAN demo scope — quirks with no event_slug (World Cup site). */
  lanOnly?: boolean;
};

function buildQuirkListQuery(params: QuirkListParams): {
  sql: string;
  bindings: unknown[];
} {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (params.status !== "all") {
    conditions.push("status = ?");
    bindings.push(params.status);
  }

  if (params.category === "uncategorized") {
    conditions.push("(category IS NULL OR category = '')");
  } else if (params.category !== "all") {
    conditions.push("category = ?");
    bindings.push(params.category);
  }

  if (params.eventSlug) {
    conditions.push("event_slug = ?");
    bindings.push(params.eventSlug);
  } else if (params.lanOnly) {
    conditions.push("(event_slug IS NULL OR event_slug = '')");
  }

  const search = params.q.trim();
  if (search) {
    const like = `%${search.replace(/[%_\\]/g, "")}%`;
    conditions.push(`(
      kit_name LIKE ? OR
      asset_tag LIKE ? OR
      reporter_email LIKE ? OR
      reporter_name LIKE ? OR
      guest_label LIKE ? OR
      quirk_details LIKE ? OR
      extra_notes LIKE ? OR
      reference_id LIKE ?
    )`);
    for (let i = 0; i < 8; i++) bindings.push(like);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return {
    sql: `SELECT ${QUIRK_REPORT_COLUMNS}
          FROM quirk_reports
          ${where}
          ORDER BY created_at DESC
          LIMIT ?`,
    bindings: [...bindings, params.limit],
  };
}

export function listQuirkReports(
  db: Database.Database,
  params: QuirkListParams,
) {
  const { sql, bindings } = buildQuirkListQuery(params);
  return db.prepare(sql).all(...bindings);
}

export function listQuirkReportsForExport(
  db: Database.Database,
  params: Omit<QuirkListParams, "limit">,
) {
  return listQuirkReports(db, { ...params, limit: 5000 });
}

export function quirkCategoryStats(
  db: Database.Database,
  scope?: { eventSlug?: string; lanOnly?: boolean },
) {
  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (scope?.eventSlug) {
    conditions.push("event_slug = ?");
    bindings.push(scope.eventSlug);
  } else if (scope?.lanOnly) {
    conditions.push("(event_slug IS NULL OR event_slug = '')");
  }
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM quirk_reports ${where}`).get(
      ...bindings,
    ) as { c: number }
  ).c;

  const rows = db
    .prepare(
      `SELECT COALESCE(NULLIF(category, ''), 'uncategorized') as bucket, COUNT(*) as c
       FROM quirk_reports
       ${where}
       GROUP BY bucket`,
    )
    .all(...bindings) as Array<{ bucket: string; c: number }>;

  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    byCategory[row.bucket] = row.c;
  }

  const percentages: Record<string, number> = {};
  if (total > 0) {
    for (const [key, count] of Object.entries(byCategory)) {
      percentages[key] = Math.round((count / total) * 1000) / 10;
    }
  }

  return { total, byCategory, percentages };
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function quirkReportsToCsv(
  reports: Array<Record<string, unknown>>,
): string {
  const headers = [
    "Reference",
    "Status",
    "Category",
    "Kit",
    "Asset tag",
    "Reporter",
    "Email",
    "Details",
    "Extra notes",
    "Resolution notes",
    "Created",
    "Resolved at",
    "Resolved by",
    "IP",
  ];

  const rows = reports.map((r) =>
    [
      r.reference_id,
      r.status,
      r.category,
      r.kit_name,
      r.asset_tag,
      r.reporter_name ?? r.guest_label,
      r.reporter_email,
      r.quirk_details,
      r.extra_notes,
      r.resolution_notes,
      r.created_at,
      r.resolved_at,
      r.resolved_by,
      r.client_ip,
    ]
      .map(csvEscape)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\r\n");
}
