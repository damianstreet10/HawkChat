/**
 * GET /api/admin/events/[slug]/members — admin lists event members.
 * POST — event editor adds member(s) by email.
 * Callers: event members admin UI. Debug requireAdmin vs requireEventEditor,
 * unregistered emails, or duplicate enrollments.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  requireAdmin,
  requireRegisteredUserByEmail,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";
import { requireEventEditor } from "@/lib/event-ownership";

type Params = { params: { slug: string } };

/** Admin: list enrolled users for the event. */
export async function GET(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const event = getEventBySlug(params.slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const db = getDb();
  const members = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, em.created_at AS enrolled_at
       FROM event_members em
       JOIN users u ON u.id = em.user_id
       WHERE em.event_id = ?
       ORDER BY lower(u.email)`,
    )
    .all(event.id) as Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    enrolled_at: string;
  }>;

  return NextResponse.json({
    event: { id: event.id, slug: event.slug, title: event.title },
    members,
  });
}

/** Event editor: enroll user(s) by email into event_members. */
export async function POST(request: Request, { params }: Params) {
  let event;
  try {
    ({ event } = requireEventEditor(request, params.slug));
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const emails = Array.isArray(body.emails)
    ? body.emails
        .filter((e: unknown) => typeof e === "string")
        .map((e: string) => e.trim().toLowerCase())
        .filter((e: string) => e.includes("@"))
    : typeof body.email === "string" && body.email.includes("@")
      ? [body.email.trim().toLowerCase()]
      : [];

  if (emails.length === 0) {
    return NextResponse.json(
      { error: "Provide at least one email address." },
      { status: 400 },
    );
  }

  const db = getDb();
  const now = new Date().toISOString();
  const added: string[] = [];
  const alreadyMembers: string[] = [];
  const notRegistered: string[] = [];

  for (const email of emails) {
    let user;
    try {
      user = requireRegisteredUserByEmail(email);
    } catch {
      notRegistered.push(email);
      continue;
    }
    const existing = db
      .prepare(
        `SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ?`,
      )
      .get(event.id, user.id);
    if (existing) {
      alreadyMembers.push(email);
      continue;
    }
    db.prepare(
      `INSERT INTO event_members (event_id, user_id, created_at) VALUES (?, ?, ?)`,
    ).run(event.id, user.id, now);
    added.push(email);
  }

  if (added.length === 0 && notRegistered.length > 0) {
    return NextResponse.json(
      {
        error: `No HawkChat account for: ${notRegistered.join(", ")}. Ask them to create an account first.`,
        notRegistered,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    added,
    alreadyMembers,
    notRegistered,
  });
}
