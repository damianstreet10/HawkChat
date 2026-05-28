import { NextResponse } from "next/server";
import {
  authErrorResponse,
  createSession,
  hashToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  grantSiteAccessCookieOptions,
  isSiteGateEnabled,
} from "@/lib/site-gate";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const token =
      typeof body.token === "string" ? body.token.trim() : "";

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and access token required" },
        { status: 400 },
      );
    }

    const db = getDb();
    const user = db
      .prepare(
        `SELECT id, email, name, role, token_hash FROM users WHERE email = ?`,
      )
      .get(email) as
      | {
          id: string;
          email: string;
          name: string;
          role: string;
          token_hash: string;
        }
      | undefined;

    if (!user || user.token_hash !== hashToken(token)) {
      return NextResponse.json(
        { error: "Invalid email or access token" },
        { status: 401 },
      );
    }

    const sessionId = createSession(user.id);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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
