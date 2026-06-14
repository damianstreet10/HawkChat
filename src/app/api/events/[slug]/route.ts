import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
  requireAdmin,
} from "@/lib/auth";
import { eventCookieOptions } from "@/lib/event-cookie";
import { ensureEventDocuments } from "@/lib/event-seed";
import {
  deleteEventBySlug,
  getEventBySlug,
  isUserEventMember,
} from "@/lib/events";
import { isStaffPortalRole } from "@/lib/permissions";
import {
  getEventManifestNotebooks,
  isWorldCupEvent,
} from "@/lib/world-cup-event";
import { readEventManifest } from "@/lib/event-manifest";

type Params = { params: { slug: string } };

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

    if (
      !isStaffPortalRole(user.role) &&
      !isUserEventMember(user.id, params.slug)
    ) {
      return NextResponse.json({ error: "Not a member of this event" }, {
        status: 403,
      });
    }

    await ensureEventDocuments(params.slug);

    const manifest = readEventManifest(params.slug);
    const res = NextResponse.json({
      ...event,
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

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireAdmin(request);
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
