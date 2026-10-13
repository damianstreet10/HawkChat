/**
 * GET /api/lan-url — LAN URL for QR / share (env override or auto-detected).
 * Callers: admin/LAN UI. Debug here if QR points to wrong host/port or
 * NEXT_PUBLIC_HAWKCHAT_LAN_URL is invalid and falls back unexpectedly.
 */
import { NextResponse } from "next/server";
import { buildLanUrl, isValidLanUrl } from "@/lib/lan-url";

/** Resolve shareable LAN URL from env or local network detection. */
export async function GET() {
  const fromEnv = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_URL?.trim() ?? "";
  const port = Number(process.env.PORT ?? 3000);

  const url =
    fromEnv && isValidLanUrl(fromEnv)
      ? fromEnv
      : buildLanUrl(port) ?? fromEnv;

  return NextResponse.json({ url: url || null });
}
