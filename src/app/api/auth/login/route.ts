/**
 * POST /api/auth/login — email + password sign-in (session cookie).
 * Callers: /login/staff. Debug wrong password, missing password_hash (legacy claim),
 * or session cookie / site-gate side effects.
 */
import { NextResponse } from "next/server";
import {
  authenticateWithPassword,
  authErrorResponse,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth";
import { loginRedirectForUser } from "@/lib/events";
import {
  grantSiteAccessCookieOptions,
  isSiteGateEnabled,
} from "@/lib/site-gate";

/** Staff/member login by email + password. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 },
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password required" },
        { status: 400 },
      );
    }

    const user = authenticateWithPassword(email, password);
    const sessionId = createSession(user.id);
    const redirectTo = loginRedirectForUser(user.id, user.role);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      redirectTo,
    });
    response.cookies.set(sessionCookieOptions(sessionId));
    if (isSiteGateEnabled()) {
      response.cookies.set(grantSiteAccessCookieOptions());
    }
    return response;
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
