/**
 * GET /api/admin/quirks/stats — LAN quirk category breakdown (monitor+).
 * Callers: admin stats / quirks dashboard. Debug empty stats if reports are
 * event-scoped rather than lanOnly.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { quirkCategoryStats } from "@/lib/quirk-query";

/** Monitor+: category counts for LAN/World Cup quirks. */
export async function GET(request: Request) {
  try {
    requireMonitor(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  return NextResponse.json(quirkCategoryStats(db, { lanOnly: true }));
}
