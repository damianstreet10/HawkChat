import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import {
  generateClientSessionId,
  getClientIp,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";
import { getDb } from "@/lib/db";
import { inferQuirkCategory, quirkCategoryLabel } from "@/lib/quirk-auto-category";
import type { QuirkCategory } from "@/lib/quirk-category";
import { notifyNewQuirkReport } from "@/lib/quirk-notify";
import { allocateQuirkReferenceId } from "@/lib/quirk-reference";
import { readGuestLabelFromCookie } from "@/lib/site-gate";
import { isValidEmail, normalizeEmail } from "@/lib/validate-email";

export async function POST(request: Request) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const kitName =
    typeof body.kitName === "string" ? body.kitName.trim() : "";
  const quirkDetails =
    typeof body.quirkDetails === "string" ? body.quirkDetails.trim() : "";
  const reporterName =
    typeof body.reporterName === "string" ? body.reporterName.trim() : "";
  const reporterEmail =
    typeof body.reporterEmail === "string"
      ? normalizeEmail(body.reporterEmail)
      : "";
  const assetTag =
    typeof body.assetTag === "string" ? body.assetTag.trim() : "";
  const extraNotes =
    typeof body.extraNotes === "string" ? body.extraNotes.trim() : "";

  if (!kitName || !quirkDetails) {
    return NextResponse.json(
      { error: "Kit/equipment and quirk description are required" },
      { status: 400 },
    );
  }

  if (!reporterEmail || !isValidEmail(reporterEmail)) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 },
    );
  }

  const clientSessionId =
    getClientSessionIdFromRequest(request) ?? generateClientSessionId();
  const guestLabel =
    reporterName ||
    readGuestLabelFromCookie(request.headers.get("cookie")) ||
    null;

  const db = getDb();
  const id = uuidv4();
  const referenceId = allocateQuirkReferenceId(db);
  const now = new Date().toISOString();
  const category: QuirkCategory = inferQuirkCategory({
    kitName,
    assetTag,
    quirkDetails,
    extraNotes,
  });

  db.prepare(
    `INSERT INTO quirk_reports (
       id, reference_id, reporter_name, reporter_email, kit_name, asset_tag,
       quirk_details, extra_notes, category, category_source,
       client_ip, client_session_id, guest_label, created_at, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', ?, ?, ?, ?, 'new')`,
  ).run(
    id,
    referenceId,
    guestLabel,
    reporterEmail,
    kitName,
    assetTag || null,
    quirkDetails,
    extraNotes || null,
    category,
    getClientIp(request),
    clientSessionId,
    guestLabel,
    now,
  );

  notifyNewQuirkReport({
    reference_id: referenceId,
    kit_name: kitName,
    asset_tag: assetTag || null,
    quirk_details: quirkDetails,
    reporter_name: guestLabel,
    reporter_email: reporterEmail,
    category,
  }).catch((err) => {
    console.warn("[HawkChat] New quirk notify failed:", err);
  });

  return NextResponse.json({
    id,
    referenceId,
    category,
    created_at: now,
    message: `Report ${referenceId} saved (${quirkCategoryLabel(category)}). You will receive an email when an admin marks it resolved.`,
  });
}
