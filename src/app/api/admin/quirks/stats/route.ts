import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { quirkCategoryStats } from "@/lib/quirk-query";

/** Category breakdown for a future admin stats dashboard. */
export async function GET(request: Request) {
  try {
    requireMonitor(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  return NextResponse.json(quirkCategoryStats(db));
}
