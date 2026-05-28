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
  const rows = db
    .prepare(
      `SELECT m.id, m.notebook_id, m.content, m.client_ip, m.client_session_id,
              m.guest_label, m.created_at, n.title AS notebook_title
       FROM messages m
       JOIN notebooks n ON n.id = m.notebook_id
       WHERE m.role = 'user'
       ORDER BY m.created_at DESC
       LIMIT ?`,
    )
    .all(limit);

  return NextResponse.json({ questions: rows });
}
