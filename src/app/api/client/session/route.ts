import { NextResponse } from "next/server";
import {
  clientSessionCookieOptions,
  generateClientSessionId,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";
import { readGuestLabelFromCookie } from "@/lib/site-gate";

/** Ensure each browser gets a private guest session id (for scoped chat history). */
export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  let sessionId = getClientSessionIdFromRequest(request);
  const created = !sessionId;
  if (!sessionId) sessionId = generateClientSessionId();

  const guestLabel = readGuestLabelFromCookie(cookieHeader) ?? null;

  const res = NextResponse.json({
    clientSessionId: sessionId,
    created,
    guestLabel,
  });
  if (created) {
    res.cookies.set(clientSessionCookieOptions(sessionId));
  }
  return res;
}
