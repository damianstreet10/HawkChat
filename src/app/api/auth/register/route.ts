/**
 * POST /api/auth/register — create an account (or claim a legacy passwordless one).
 * Callers: /login/register. Debug duplicate email 409, weak password, or claim flow
 * for seeded users who never had a password.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  createSession,
  registerAccount,
  sessionCookieOptions,
} from "@/lib/auth";
import { loginRedirectForUser } from "@/lib/events";
import {
  grantSiteAccessCookieOptions,
  isSiteGateEnabled,
} from "@/lib/site-gate";

/** Public self-registration; signs the user in after success. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 },
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password required" },
        { status: 400 },
      );
    }

    const user = registerAccount({ email, password, name });
    const sessionId = createSession(user.id);
    const redirectTo = loginRedirectForUser(user.id, user.role);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      claimed: user.claimed,
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
