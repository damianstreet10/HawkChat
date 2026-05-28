import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  try {
    requireMonitor(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
  );

  const db = getDb();
  const reports = db
    .prepare(
      `SELECT id, reporter_name, kit_name, asset_tag, quirk_details, extra_notes,
              client_ip, client_session_id, guest_label, created_at
       FROM quirk_reports
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit);

  return NextResponse.json({ reports });
}
