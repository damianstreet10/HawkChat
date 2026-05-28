import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  authErrorResponse,
  generateAccessToken,
  hashToken,
  requireAdmin,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const db = getDb();
    const users = db
      .prepare(
        `SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC`,
      )
      .all();
    return NextResponse.json(users);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : email.split("@")[0];
    const role = (
      ["viewer", "contributor", "admin", "monitor"] as Role[]
    ).includes(body.role)
      ? (body.role as Role)
      : "viewer";

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
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
      `INSERT INTO users (id, email, name, role, token_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, email, name, role, hashToken(accessToken), now);

    return NextResponse.json({
      id,
      email,
      name,
      role,
      roleLabel: ROLE_LABELS[role],
      created_at: now,
      accessToken,
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
