/**
 * POST /api/auth/logout — clears staff session and event cookies.
 * Callers: signed-in UI logout. Debug here if session persists after logout
 * or event context cookie is not cleared.
 */
import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  deleteSession,
  getSessionIdFromRequest,
} from "@/lib/auth";
import { clearEventCookieOptions } from "@/lib/event-cookie";

/** Revoke session server-side and clear session + event cookies. */
export async function POST(request: Request) {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) deleteSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  response.cookies.set(clearEventCookieOptions());
  return response;
}
