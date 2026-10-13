/**
 * GET /api/auth/site-status — whether the site password gate is enabled.
 * Callers: login UI to choose guest vs staff flows. Debug here if the gate
 * UI does not match HAWKCHAT_SITE_PASSWORD being set/unset.
 */
import { NextResponse } from "next/server";
import { isSiteGateEnabled } from "@/lib/site-gate";

/** Public flag: { siteGate: boolean }. */
export async function GET() {
  return NextResponse.json({ siteGate: isSiteGateEnabled() });
}
