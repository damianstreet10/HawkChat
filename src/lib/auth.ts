import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import {
  canManageNotebooks,
  canManageUsers,
  canUploadSources,
  canViewActivity,
  hasMinRole,
  type Role,
} from "./permissions";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

const SESSION_COOKIE = "hawkchat_session";
const SESSION_DAYS = 30;

/** True only when every visitor must sign in (LAN demo stays open by default). */
export function isAuthRequired(): boolean {
  return process.env.HAWKCHAT_REQUIRE_AUTH === "true";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

export function createSession(userId: string): string {
  const db = getDb();
  const { v4: uuidv4 } = require("uuid") as typeof import("uuid");
  const sessionId = uuidv4();
  const now = new Date();
  const expires = new Date(
    now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).run(sessionId, userId, expires, now.toISOString());

  return sessionId;
}

export function getUserBySessionId(
  sessionId: string | undefined,
): AuthUser | null {
  if (!sessionId) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .get(sessionId) as AuthUser | undefined;

  return row ?? null;
}

export function getSessionIdFromRequest(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp(`${SESSION_COOKIE}=([^;]+)`),
  );
  return match?.[1];
}

export function getAuthUserFromRequest(request: Request): AuthUser | null {
  return getUserBySessionId(getSessionIdFromRequest(request));
}

export function getAuthUserFromCookies(): AuthUser | null {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  return getUserBySessionId(sessionId);
}

export function sessionCookieOptions(sessionId: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return {
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function requireAuth(request: Request): AuthUser {
  const user = getAuthUserFromRequest(request);
  if (user) return user;
  if (!isAuthRequired()) {
    return {
      id: "anonymous",
      email: "guest@hawkchat",
      name: "Guest",
      role: "viewer",
    };
  }
  throw new AuthError("Sign in required");
}

export function requireRole(request: Request, minRole: Role): AuthUser {
  const user = requireAuth(request);
  if (!hasMinRole(user.role, minRole)) {
    throw new AuthError("You do not have permission for this action", 403);
  }
  return user;
}

export function requireUpload(request: Request): AuthUser {
  const user = requireAuth(request);
  if (!canUploadSources(user.role)) {
    throw new AuthError(
      "View-only accounts can chat but cannot upload sources",
      403,
    );
  }
  return user;
}

export function requireNotebookManage(request: Request): AuthUser {
  const user = requireAuth(request);
  if (!canManageNotebooks(user.role)) {
    throw new AuthError("You do not have permission to manage notebooks", 403);
  }
  return user;
}

export function requireAdmin(request: Request): AuthUser {
  const user = requireAuth(request);
  if (!canManageUsers(user.role)) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
}

/** Signed-in monitor or admin (works even when guest access is open). */
export function requireMonitor(request: Request): AuthUser {
  const user = getAuthUserFromRequest(request);
  if (!user) throw new AuthError("Sign in required");
  if (!canViewActivity(user.role)) {
    throw new AuthError("Monitor access required", 403);
  }
  return user;
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json(
      { error: err.message },
      { status: err.status },
    );
  }
  return null;
}
