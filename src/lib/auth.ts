/**
 * Session auth, cookie helpers, and role guards for API routes.
 * Look here when login fails, sessions expire unexpectedly, or requireAuth/requireAdmin
 * returns 401/403 — check HAWKCHAT_REQUIRE_AUTH and the hawkchat_session cookie.
 * Account passwords live in users.password_hash (see passwords.ts + /api/auth/register).
 */
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "./passwords";
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

type UserAuthRow = AuthUser & {
  password_hash: string | null;
};

// --- Sessions & tokens ---

const SESSION_COOKIE = "hawkchat_session";
const SESSION_DAYS = 30;

/** True only when every visitor must sign in (LAN demo stays open by default). */
export function isAuthRequired(): boolean {
  return process.env.HAWKCHAT_REQUIRE_AUTH === "true";
}

/** SHA-256 hex digest used for token_hash columns / legacy tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

/** Display name from email local-part (e.g. jane.doe → Jane Doe). */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  return name || "User";
}

// --- Users ---

/** Lookup only — does not create accounts. */
export function getUserByEmail(email: string): AuthUser | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const db = getDb();
  const row = db
    .prepare(`SELECT id, email, name, role FROM users WHERE email = ?`)
    .get(normalized) as AuthUser | undefined;
  return row ?? null;
}

function getUserAuthRowByEmail(email: string): UserAuthRow | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, email, name, role, password_hash FROM users WHERE email = ?`,
    )
    .get(normalized) as UserAuthRow | undefined;
  return row ?? null;
}

/**
 * Enroll only users who already registered. Does not create accounts.
 * Admins should pick from the members list after someone signs up.
 */
export function requireRegisteredUserByEmail(email: string): AuthUser {
  const user = getUserByEmail(email);
  if (!user) {
    throw new AuthError(
      `${email.trim().toLowerCase()} has no HawkChat account yet. Ask them to create one at Create account first.`,
      400,
    );
  }
  return user;
}

/**
 * @deprecated Prefer requireRegisteredUserByEmail — does not create passwordless accounts.
 */
export function findOrCreateUserByEmail(email: string): AuthUser {
  return requireRegisteredUserByEmail(email);
}

/**
 * Create a new account, or set a password on a legacy account that has none yet.
 */
export function registerAccount(opts: {
  email: string;
  password: string;
  name?: string;
}): AuthUser & { claimed: boolean } {
  const email = opts.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new AuthError("Valid email required", 400);
  }

  const strength = validatePasswordStrength(opts.password);
  if (strength) {
    throw new AuthError(strength, 400);
  }

  const existing = getUserAuthRowByEmail(email);
  const passwordHash = hashPassword(opts.password);
  const db = getDb();

  if (existing) {
    if (existing.password_hash) {
      throw new AuthError(
        "An account with this email already exists. Sign in instead.",
        409,
      );
    }
    const name =
      typeof opts.name === "string" && opts.name.trim()
        ? opts.name.trim()
        : existing.name;
    db.prepare(
      `UPDATE users SET password_hash = ?, name = ? WHERE id = ?`,
    ).run(passwordHash, name, existing.id);
    return {
      id: existing.id,
      email: existing.email,
      name,
      role: existing.role,
      claimed: true,
    };
  }

  const { v4: uuidv4 } = require("uuid") as typeof import("uuid");
  const id = uuidv4();
  const name =
    typeof opts.name === "string" && opts.name.trim()
      ? opts.name.trim()
      : displayNameFromEmail(email);
  const now = new Date().toISOString();
  const tokenHash = hashToken(`password-account:${email}`);

  db.prepare(
    `INSERT INTO users (id, email, name, role, token_hash, created_at, password_hash)
     VALUES (?, ?, ?, 'viewer', ?, ?, ?)`,
  ).run(id, email, name, tokenHash, now, passwordHash);

  return { id, email, name, role: "viewer", claimed: false };
}

/** Verify email + password for login. */
export function authenticateWithPassword(
  email: string,
  password: string,
): AuthUser {
  const row = getUserAuthRowByEmail(email);
  if (!row) {
    throw new AuthError("Invalid email or password.", 401);
  }
  if (!row.password_hash) {
    throw new AuthError(
      "This account does not have a password yet. Use Create account with this email to set one.",
      403,
    );
  }
  if (!verifyPassword(password, row.password_hash)) {
    throw new AuthError("Invalid email or password.", 401);
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

/** Set or replace password (admin reset or authenticated change). */
export function setUserPassword(userId: string, password: string): void {
  const strength = validatePasswordStrength(password);
  if (strength) {
    throw new AuthError(strength, 400);
  }
  const db = getDb();
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(
    hashPassword(password),
    userId,
  );
}

/** Create a DB session row and return the raw session id (for the cookie). */
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

/** End staff sign-in (e.g. when a guest takes over a shared device). */
export function revokeStaffSession(request: Request): void {
  const sessionId = getSessionIdFromRequest(request);
  if (sessionId) deleteSession(sessionId);
}

// --- Guards ---

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Require a signed-in user, or anonymous guest when HAWKCHAT_REQUIRE_AUTH is off.
 */
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

/** Map AuthError to JSON Response; rethrow unexpected errors. */
export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json(
      { error: err.message },
      { status: err.status },
    );
  }
  return null;
}
