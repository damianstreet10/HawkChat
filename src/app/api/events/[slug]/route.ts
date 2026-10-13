/**
 * GET /api/events/[slug] — event detail for members (sets event cookie).
 * PATCH — event editors update metadata (title, dates, department, …).
 * DELETE — event editors delete (World Cup protected).
 * Callers: event home / admin edit. Debug access 403, seed/ensure docs, or WC delete block.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
} from "@/lib/auth";
import { eventCookieOptions } from "@/lib/event-cookie";
import { ensureEventDocuments } from "@/lib/event-seed";
import { canAccessEvent } from "@/lib/event-access";
import { getDb } from "@/lib/db";
import {
  attachCreator,
  deleteEventBySlug,
  getEventBySlug,
  parseEventDate,
  withEventStatus,
} from "@/lib/events";
import { parseEventDepartment } from "@/lib/event-departments";
import {
  canEditEvent,
  requireEventEditor,
} from "@/lib/event-ownership";
import {
  getEventManifestNotebooks,
  isWorldCupEvent,
} from "@/lib/world-cup-event";
import { readEventManifest } from "@/lib/event-manifest";

type Params = { params: { slug: string } };

/** Member: load event, ensure docs seeded, set hawkchat_event cookie. */
export async function GET(request: Request, { params }: Params) {
  try {
    const user = getAuthUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const event = getEventBySlug(params.slug);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!canAccessEvent(user, params.slug)) {
      return NextResponse.json({ error: "Not a member of this event" }, {
        status: 403,
      });
    }

    await ensureEventDocuments(params.slug);

    const manifest = readEventManifest(params.slug);
    const status = withEventStatus(attachCreator(event));
    const res = NextResponse.json({
      ...status,
      canEdit: canEditEvent(user, event),
      manifestDescription: isWorldCupEvent(params.slug)
        ? "Live LAN support site — guest questions and kit quirks from the public login at home."
        : (manifest?.eventDescription ?? event.description),
      notebookCount: getEventManifestNotebooks(params.slug).length,
    });
    res.cookies.set(eventCookieOptions(params.slug));
    return res;
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Event editor: update title/description/department/dates. */
export async function PATCH(request: Request, { params }: Params) {
  let event;
  try {
    ({ event } = requireEventEditor(request, params.slug));
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" ? body.title.trim() : event.title;
  const description =
    body.description === undefined
      ? event.description
      : typeof body.description === "string"
        ? body.description.trim() || null
        : event.description;

  let department = event.department;
  if (body.department !== undefined) {
    const parsed = parseEventDepartment(body.department);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "department must be football-events, uk-football, cricket, rugby, or tennis.",
        },
        { status: 400 },
      );
    }
    department = parsed;
  }

  const startsAt =
    body.startsAt === undefined && body.starts_at === undefined
      ? event.starts_at
      : parseEventDate(body.startsAt ?? body.starts_at);
  const endsAt =
    body.endsAt === undefined && body.ends_at === undefined
      ? event.ends_at
      : parseEventDate(body.endsAt ?? body.ends_at);

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (startsAt && endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: "End date must be on or after the start date." },
      { status: 400 },
    );
  }

  const db = getDb();
  db.prepare(
    `UPDATE events
     SET title = ?, description = ?, department = ?, starts_at = ?, ends_at = ?
     WHERE id = ?`,
  ).run(title, description, department, startsAt, endsAt, event.id);

  const updated = getEventBySlug(params.slug);
  if (!updated) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    event: {
      ...withEventStatus(attachCreator(updated)),
      notebookCount: getEventManifestNotebooks(params.slug).length,
      canEdit: true,
    },
  });
}

/** Event editor: delete event (blocked for World Cup 2026). */
export async function DELETE(request: Request, { params }: Params) {
  try {
    requireEventEditor(request, params.slug);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  if (isWorldCupEvent(params.slug)) {
    return NextResponse.json(
      { error: "World Cup 2026 cannot be deleted." },
      { status: 403 },
    );
  }

  const event = getEventBySlug(params.slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  deleteEventBySlug(params.slug);

  return NextResponse.json({ ok: true, slug: params.slug, title: event.title });
}
