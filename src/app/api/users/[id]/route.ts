import { NextResponse } from "next/server";
import {
  authErrorResponse,
  generateAccessToken,
  hashToken,
  requireAdmin,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/permissions";

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const admin = requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const db = getDb();

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
      updates.push("role = ?");
      values.push(body.role as Role);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    values.push(params.id);
    const result = db
      .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values);

    if (result.changes === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = db
      .prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ?`)
      .get(params.id);

    return NextResponse.json(user);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const admin = requireAdmin(request);
    if (params.id === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const db = getDb();
    const tx = db.transaction(() => {
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
