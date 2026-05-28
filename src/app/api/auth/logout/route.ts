import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  deleteSession,
  getSessionIdFromRequest,
} from "@/lib/auth";

export async function POST(request: Request) {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) deleteSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  return response;
}
