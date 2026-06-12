import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventAdminError, requireEventMonitor } from "@/lib/event-admin-api";
import { isQuirkCategory } from "@/lib/quirk-category";
import { sendQuirkResolvedEmail } from "@/lib/quirk-email";
import { QUIRK_REPORT_COLUMNS } from "@/lib/quirk-query";
import { isQuirkStatus } from "@/lib/quirk-status";
import { isWorldCupEvent } from "@/lib/world-cup-event";

type Params = { params: { slug: string; id: string } };

type ExistingReport = {
  id: string;
  reference_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  kit_name: string;
  asset_tag: string | null;
  quirk_details: string;
  extra_notes: string | null;
  resolution_notes: string | null;
  category: string | null;
  category_source: string | null;
  created_at: string;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  event_slug: string | null;
};

export async function PATCH(request: Request, { params }: Params) {
  let admin;
  try {
    admin = requireEventMonitor(request, params.slug);
  } catch (err) {
    const res = eventAdminError(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const hasStatus = typeof body.status === "string";
  const hasCategory = body.category !== undefined;
  const hasResolutionNotes = typeof body.resolutionNotes === "string";

  if (!hasStatus && !hasCategory && !hasResolutionNotes) {
    return NextResponse.json(
      { error: "Provide status, category, and/or resolutionNotes" },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT ${QUIRK_REPORT_COLUMNS} FROM quirk_reports WHERE id = ?`)
    .get(params.id) as ExistingReport | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const inScope = isWorldCupEvent(params.slug)
    ? !existing.event_slug
    : existing.event_slug === params.slug;
  if (!inScope) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  let nextStatus = existing.status;
  if (hasStatus) {
    const status = body.status.trim();
    if (!isQuirkStatus(status)) {
      return NextResponse.json(
        { error: "Status must be new, in_progress, or resolved" },
        { status: 400 },
      );
    }
    nextStatus = status;
  }

  let nextCategory = existing.category;
  if (hasCategory) {
    if (body.category === null || body.category === "") {
      nextCategory = null;
    } else if (
      typeof body.category === "string" &&
      isQuirkCategory(body.category)
    ) {
      nextCategory = body.category;
    } else {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
  }

  let nextResolutionNotes = existing.resolution_notes;
  if (hasResolutionNotes) {
    nextResolutionNotes = body.resolutionNotes.trim() || null;
  }

  const now = new Date().toISOString();
  let resolvedAt = existing.resolved_at;
  let resolvedBy = existing.resolved_by;

  if (nextStatus === "resolved" && existing.status !== "resolved") {
    resolvedAt = now;
    resolvedBy = admin.email;
  } else if (nextStatus !== "resolved") {
    resolvedAt = null;
    resolvedBy = null;
  }

  const nextCategorySource = hasCategory
    ? "manual"
    : (existing.category_source ?? "auto");

  db.prepare(
    `UPDATE quirk_reports
     SET status = ?, category = ?, category_source = ?, resolution_notes = ?, resolved_at = ?, resolved_by = ?
     WHERE id = ?`,
  ).run(
    nextStatus,
    nextCategory,
    nextCategorySource,
    nextResolutionNotes,
    resolvedAt,
    resolvedBy,
    params.id,
  );

  let emailNotice: string | null = null;

  if (nextStatus === "resolved" && existing.status !== "resolved") {
    if (!existing.reporter_email?.trim()) {
      emailNotice =
        "Marked resolved, but this report has no email on file — nothing was sent.";
    } else {
      const result = await sendQuirkResolvedEmail(admin, {
        reference_id: existing.reference_id,
        kit_name: existing.kit_name,
        asset_tag: existing.asset_tag,
        quirk_details: existing.quirk_details,
        extra_notes: existing.extra_notes,
        resolution_notes: nextResolutionNotes,
        reporter_name: existing.reporter_name,
        reporter_email: existing.reporter_email,
        created_at: existing.created_at,
      });
      if (result.sent) {
        emailNotice = `Resolution email sent to ${existing.reporter_email}.`;
      } else {
        emailNotice =
          result.error ??
          "Marked resolved, but the notification email could not be sent.";
      }
    }
  }

  const report = db
    .prepare(`SELECT ${QUIRK_REPORT_COLUMNS} FROM quirk_reports WHERE id = ?`)
    .get(params.id);

  return NextResponse.json({ report, emailNotice });
}
