import { NextResponse } from "next/server";
import {
  clientSessionCookieOptions,
  generateClientSessionId,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";

/** Ensure each browser gets a private guest session id (for scoped chat history). */
export async function GET(request: Request) {
  let sessionId = getClientSessionIdFromRequest(request);
  const created = !sessionId;
  if (!sessionId) sessionId = generateClientSessionId();

  const res = NextResponse.json({ clientSessionId: sessionId, created });
  if (created) {
    res.cookies.set(clientSessionCookieOptions(sessionId));
  }
  return res;
}
