/**
 * GET /api/events — list events the signed-in user can access.
 * POST /api/events — admin creates an event (+ members + notebook provision).
 * Callers: events picker / admin create form. Debug GET for membership/access;
 * POST for slug conflicts, department validation, or provision/seed failures.
 */
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  authErrorResponse,
  getAuthUserFromRequest,
  requireAdmin,
  requireRegisteredUserByEmail,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { provisionEventNotebooks, parseCustomNotebooks } from "@/lib/event-provision";
import { listAccessibleEventsWithStatus } from "@/lib/event-access";
import { isNotebookTemplateId } from "@/lib/notebook-templates";
import { attachCreator, parseEventDate } from "@/lib/events";
import { parseEventDepartment } from "@/lib/event-departments";
import { canEditEvent } from "@/lib/event-ownership";
import {
  getEventManifestNotebooks,
  sortEventsForPicker,
} from "@/lib/world-cup-event";

/** Signed-in: accessible events with status, notebook counts, and canEdit. */
export async function GET(request: Request) {
  try {
    const user = getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const events = sortEventsForPicker(
      listAccessibleEventsWithStatus(user).map((event) => {
        const withCreator = attachCreator(event);
        return {
          ...withCreator,
          notebookCount: getEventManifestNotebooks(event.slug).length,
          canEdit: canEditEvent(user, event),
        };
      }),
    );

    return NextResponse.json({ events });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Admin: create event row, enroll members, provision notebooks from templates. */
export async function POST(request: Request) {
  let admin;
  try {
    admin = requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const slug =
    typeof body.slug === "string"
      ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
      : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const memberEmails = Array.isArray(body.memberEmails)
    ? body.memberEmails
        .filter((e: unknown) => typeof e === "string")
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const notebookTemplates = Array.isArray(body.notebookTemplates)
    ? body.notebookTemplates
        .filter((id: unknown) => typeof id === "string")
        .map((id: string) => id.trim())
        .filter(isNotebookTemplateId)
    : [];
  const customNotebooks = parseCustomNotebooks(body.customNotebooks);
  const startsAt = parseEventDate(body.startsAt ?? body.starts_at);
  const endsAt = parseEventDate(body.endsAt ?? body.ends_at);
  const department = parseEventDepartment(body.department);

  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 },
    );
  }

  if (!department) {
    return NextResponse.json(
      {
        error:
          "department is required (football-events, uk-football, cricket, rugby, or tennis).",
      },
      { status: 400 },
    );
  }

  if (startsAt && endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: "End date must be on or after the start date." },
      { status: 400 },
    );
  }

  if (notebookTemplates.length === 0 && customNotebooks.length === 0) {
    return NextResponse.json(
      {
        error:
          "Select at least one notebook template or add a custom notebook.",
      },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM events WHERE slug = ?`)
    .get(slug);
  if (existing) {
    return NextResponse.json(
      { error: "An event with this slug already exists" },
      { status: 409 },
    );
  }

  const eventId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO events (id, slug, title, description, created_at, starts_at, ends_at, department, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    eventId,
    slug,
    title,
    description || null,
    now,
    startsAt,
    endsAt,
    department,
    admin.id,
  );

  const added: string[] = [];
  const notRegistered: string[] = [];

  for (const email of memberEmails) {
    let user;
    try {
      user = requireRegisteredUserByEmail(email);
    } catch {
      notRegistered.push(email);
      continue;
    }
    db.prepare(
      `INSERT OR IGNORE INTO event_members (event_id, user_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(eventId, user.id, now);
    added.push(email);
  }

  if (memberEmails.length > 0 && added.length === 0 && notRegistered.length > 0) {
    db.prepare(`DELETE FROM events WHERE id = ?`).run(eventId);
    return NextResponse.json(
      {
        error: `No HawkChat account for: ${notRegistered.join(", ")}. Ask them to create an account first.`,
        notRegistered,
      },
      { status: 400 },
    );
  }

  let provisioned: {
    notebooks: string[];
    copiedFiles: number;
    customNotebooks: Array<{
      clientKey?: string;
      notebookId: string;
      title: string;
    }>;
  } | null = null;

  try {
    provisioned = provisionEventNotebooks(
      slug,
      title,
      description,
      notebookTemplates,
      customNotebooks,
    );
  } catch (err) {
    db.prepare(`DELETE FROM events WHERE id = ?`).run(eventId);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not set up event notebooks.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: eventId,
    slug,
    title,
    description: description || null,
    department,
    created_by: admin.id,
    created_by_name: admin.name,
    created_by_email: admin.email,
    membersAdded: added,
    startsAt,
    endsAt,
    notebooks: provisioned.notebooks,
    customNotebooks: provisioned.customNotebooks,
    copiedFiles: provisioned.copiedFiles,
    setupHint: `Event manifest written to seed/events/${slug}/. Add more PDFs there or restart with HAWKCHAT_AUTO_SEED=true to index documents.`,
  });
}
