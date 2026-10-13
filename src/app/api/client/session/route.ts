/**
 * GET /api/client/session — ensure a guest clientSessionId cookie exists.
 * Callers: chat/quirks clients before messaging. Debug here if chat history
 * mixes across users on the same device or guestLabel is missing.
 */
import { NextResponse } from "next/server";
import {
  clientSessionCookieOptions,
  generateClientSessionId,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";
import { readGuestLabelFromCookie } from "@/lib/site-gate";

/** Mint or return existing client session id (+ guest label) for scoped history. */
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
