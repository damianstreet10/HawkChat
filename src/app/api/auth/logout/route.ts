import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  deleteSession,
  getSessionIdFromRequest,
} from "@/lib/auth";
import { clearEventCookieOptions } from "@/lib/event-cookie";

export async function POST(request: Request) {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) deleteSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  response.cookies.set(clearEventCookieOptions());
  return response;
}
