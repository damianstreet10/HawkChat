import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import {
  generateClientSessionId,
  getClientIp,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";
import { getDb } from "@/lib/db";
import { readGuestLabelFromCookie } from "@/lib/site-gate";

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

  const clientSessionId =
    getClientSessionIdFromRequest(request) ?? generateClientSessionId();
  const guestLabel =
    reporterName ||
    readGuestLabelFromCookie(request.headers.get("cookie")) ||
    null;

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO quirk_reports (
       id, reporter_name, kit_name, asset_tag, quirk_details, extra_notes,
       client_ip, client_session_id, guest_label, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    guestLabel,
    kitName,
    assetTag || null,
    quirkDetails,
    extraNotes || null,
    getClientIp(request),
    clientSessionId,
    guestLabel,
    now,
  );

  return NextResponse.json({
    id,
    created_at: now,
    message: "Report saved. An admin will review it.",
  });
}
