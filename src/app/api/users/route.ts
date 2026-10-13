/**
 * GET /api/users — admin lists all users + project memberships.
 * POST /api/users — admin creates a user (super-admin for admin role).
 * Callers: Admin → Members. Debug role grants, duplicate email 409, or
 * canManageAdminRoles flags on the list response.
 */
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  authErrorResponse,
  generateAccessToken,
  hashToken,
  requireAdmin,
  setUserPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { canManageAdminRoles } from "@/lib/super-admin";
import { validatePasswordStrength } from "@/lib/passwords";

type UserProject = {
  id: string;
  slug: string;
  title: string;
};

/** Admin: list users with event projects and privilege flags. */
export async function GET(request: Request) {
  try {
    const admin = requireAdmin(request);
    const db = getDb();
    const users = db
      .prepare(
        `SELECT id, email, name, role, created_at FROM users ORDER BY lower(email) ASC`,
      )
      .all() as Array<{
      id: string;
      email: string;
      name: string;
      role: Role;
      created_at: string;
    }>;

    const memberships = db
      .prepare(
        `SELECT em.user_id, e.id, e.slug, e.title
         FROM event_members em
         JOIN events e ON e.id = em.event_id
         ORDER BY e.title`,
      )
      .all() as Array<{
      user_id: string;
      id: string;
      slug: string;
      title: string;
    }>;

    const projectsByUser = new Map<string, UserProject[]>();
    for (const row of memberships) {
      const list = projectsByUser.get(row.user_id) ?? [];
      list.push({ id: row.id, slug: row.slug, title: row.title });
      projectsByUser.set(row.user_id, list);
    }

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        roleLabel: ROLE_LABELS[u.role],
        projects: projectsByUser.get(u.id) ?? [],
      })),
      canManageAdminRoles: canManageAdminRoles(admin),
      canDeleteUsers: canManageAdminRoles(admin),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Admin: create user; returns one-time accessToken. */
export async function POST(request: Request) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : email.split("@")[0];
    let role = (
      ["viewer", "contributor", "admin", "monitor"] as Role[]
    ).includes(body.role)
      ? (body.role as Role)
      : "viewer";

    if (role === "admin" && !canManageAdminRoles(admin)) {
      return NextResponse.json(
        {
          error:
            "Only the primary admin can create accounts with admin privileges",
        },
        { status: 403 },
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const password =
      typeof body.password === "string" ? body.password : "";
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    const accessToken = generateAccessToken();
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, name, role, token_hash, created_at, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    ).run(id, email, name, role, hashToken(accessToken), now);
    setUserPassword(id, password);

    return NextResponse.json({
      id,
      email,
      name,
      role,
      roleLabel: ROLE_LABELS[role],
      created_at: now,
      projects: [],
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
