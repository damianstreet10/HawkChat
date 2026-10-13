/**
 * GET /api/admin/activity — LAN/World Cup chat exchanges for monitors.
 * Callers: global admin activity view. Debug requireMonitor and lanOnly filter
 * (tournament event chats live under /api/events/[slug]/admin/activity).
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listEventExchanges } from "@/lib/event-activity";

/** Monitor+: LAN-only chat feedback / exchanges (?limit). */
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
  const exchanges = listEventExchanges(db, limit, { lanOnly: true });

  return NextResponse.json({ exchanges });
}
