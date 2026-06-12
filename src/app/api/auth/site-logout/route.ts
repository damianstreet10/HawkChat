import { NextResponse } from "next/server";
import {
  clearSessionCookieOptions,
  revokeStaffSession,
} from "@/lib/auth";
import { clearClientSessionCookieOptions } from "@/lib/client-session";
import { clearEventCookieOptions } from "@/lib/event-cookie";
import {
  clearGuestLabelCookieOptions,
  clearSiteAccessCookieOptions,
} from "@/lib/site-gate";

export async function POST(request: Request) {
  revokeStaffSession(request);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSiteAccessCookieOptions());
  res.cookies.set(clearGuestLabelCookieOptions());
  res.cookies.set(clearClientSessionCookieOptions());
  res.cookies.set(clearEventCookieOptions());
  res.cookies.set(clearSessionCookieOptions());
  return res;
}
