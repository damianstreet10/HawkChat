import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listEventExchanges } from "@/lib/event-activity";

/** World Cup / LAN demo chat feedback only (not tournament events). */
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
