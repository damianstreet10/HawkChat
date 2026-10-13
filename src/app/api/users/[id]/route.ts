/**
 * PATCH /api/users/[id] — admin updates name/role (super-admin for admin roles).
 * DELETE — super-admin removes a user entirely.
 * POST — admin rotates access token (action: rotate-token).
 * Callers: Admin → Members. Debug demotion/delete guards for super-admins,
 * session wipe on role change, or rotate-token action mismatch.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  generateAccessToken,
  hashToken,
  requireAdmin,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { canManageAdminRoles, getSuperAdminEmails } from "@/lib/super-admin";

type Params = { params: { id: string } };

/** Admin: update name and/or role; clears sessions on role change. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const db = getDb();

    const target = db
      .prepare(`SELECT id, email, name, role FROM users WHERE id = ?`)
      .get(params.id) as
      | { id: string; email: string; name: string; role: Role }
      | undefined;

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (typeof body.name === "string" && body.name.trim()) {
      updates.push("name = ?");
      values.push(body.name.trim());
    }

    if (
      ["viewer", "contributor", "admin", "monitor"].includes(body.role) &&
      params.id !== admin.id
    ) {
      const nextRole = body.role as Role;
      const changingAdminPrivilege =
        target.role === "admin" || nextRole === "admin";

      if (changingAdminPrivilege && !canManageAdminRoles(admin)) {
        return NextResponse.json(
          {
            error:
              "Only a super admin can grant or remove admin privileges",
          },
          { status: 403 },
        );
      }

      const owners = getSuperAdminEmails();
      if (
        target.role === "admin" &&
        nextRole !== "admin" &&
        owners.includes(target.email.toLowerCase())
      ) {
        return NextResponse.json(
          { error: "A super admin account cannot be demoted" },
          { status: 400 },
        );
      }

      updates.push("role = ?");
      values.push(nextRole);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    values.push(params.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values,
    );

    // Role change should force re-login for permissions refresh.
    if (updates.some((u) => u.startsWith("role"))) {
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(params.id);
    }

    const user = db
      .prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ?`)
      .get(params.id) as {
      id: string;
      email: string;
      name: string;
      role: Role;
      created_at: string;
    };

    return NextResponse.json({
      ...user,
      roleLabel: ROLE_LABELS[user.role],
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Super-admin only: delete user, memberships, and sessions. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const admin = requireAdmin(request);
    if (!canManageAdminRoles(admin)) {
      return NextResponse.json(
        {
          error:
            "Only a super admin can remove people entirely from HawkChat",
        },
        { status: 403 },
      );
    }

    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const db = getDb();
    const target = db
      .prepare(`SELECT id, email, role FROM users WHERE id = ?`)
      .get(params.id) as
      | { id: string; email: string; role: string }
      | undefined;

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const owners = getSuperAdminEmails();
    if (owners.includes(target.email.toLowerCase())) {
      return NextResponse.json(
        { error: "A super admin account cannot be deleted" },
        { status: 400 },
      );
    }

    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM event_members WHERE user_id = ?`).run(params.id);
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(params.id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(params.id);
    });
    tx();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Admin: rotate access token (body.action === "rotate-token") and wipe sessions. */
export async function POST(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    if (body.action !== "rotate-token") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const accessToken = generateAccessToken();
    const db = getDb();
    const result = db
      .prepare(`UPDATE users SET token_hash = ? WHERE id = ?`)
      .run(hashToken(accessToken), params.id);

    if (result.changes === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(params.id);

    return NextResponse.json({ accessToken });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
