import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  authErrorResponse,
  getAuthUserFromRequest,
  requireAdmin,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { provisionEventNotebooks } from "@/lib/event-provision";
import { getUserEvents, listEvents } from "@/lib/events";
import { isNotebookTemplateId } from "@/lib/notebook-templates";
import { isStaffPortalRole } from "@/lib/permissions";
import {
  getEventManifestNotebooks,
  sortEventsForPicker,
} from "@/lib/world-cup-event";

export async function GET(request: Request) {
  try {
    const user = getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    if (isStaffPortalRole(user.role)) {
      const events = sortEventsForPicker(
        listEvents().map((event) => ({
          ...event,
          notebookCount: getEventManifestNotebooks(event.slug).length,
        })),
      );
      return NextResponse.json({ events });
    }

    const events = sortEventsForPicker(
      getUserEvents(user.id).map((event) => ({
        ...event,
        notebookCount: getEventManifestNotebooks(event.slug).length,
      })),
    );

    return NextResponse.json({ events });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
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

  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 },
    );
  }

  if (notebookTemplates.length === 0) {
    return NextResponse.json(
      { error: "Select at least one notebook template." },
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
    `INSERT INTO events (id, slug, title, description, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, slug, title, description || null, now);

  const added: string[] = [];
  const missing: string[] = [];

  for (const email of memberEmails) {
    const user = db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(email) as { id: string } | undefined;
    if (!user) {
      missing.push(email);
      continue;
    }
    db.prepare(
      `INSERT OR IGNORE INTO event_members (event_id, user_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(eventId, user.id, now);
    added.push(email);
  }

  let provisioned: {
    notebooks: string[];
    copiedFiles: number;
  } | null = null;

  try {
    provisioned = provisionEventNotebooks(
      slug,
      title,
      description,
      notebookTemplates,
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
    membersAdded: added,
    membersMissing: missing,
    notebooks: provisioned.notebooks,
    copiedFiles: provisioned.copiedFiles,
    setupHint: `Event manifest written to seed/events/${slug}/. Add more PDFs there or restart with HAWKCHAT_AUTO_SEED=true to index documents.`,
  });
}
