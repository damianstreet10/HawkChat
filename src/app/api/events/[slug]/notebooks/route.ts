/**
 * GET /api/events/[slug]/notebooks — notebooks for an event the user can access.
 * Callers: event notebook picker. Debug membership, seed/ensure docs, or empty
 * manifest notebook list after provision.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureBuiltinDocuments } from "@/lib/auto-seed";
import { ensureEventDocuments } from "@/lib/event-seed";
import {
  getEventManifestNotebooks,
  isWorldCupEvent,
} from "@/lib/world-cup-event";
import { canAccessEvent } from "@/lib/event-access";
import { getEventBySlug } from "@/lib/events";
import { getNotebookDocumentNames } from "@/lib/notebook-documents";

type Params = { params: { slug: string } };

/** Member: list event notebooks with document names (WC uses builtin seed). */
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

    if (isWorldCupEvent(params.slug)) {
      await ensureBuiltinDocuments();
    } else {
      await ensureEventDocuments(params.slug);
    }

    const notebooks = getEventManifestNotebooks(params.slug);
    if (!notebooks.length) {
      return NextResponse.json([]);
    }

    const db = getDb();
    const order = notebooks.map((n) => n.notebookId);
    const manifestById = new Map(notebooks.map((n) => [n.notebookId, n]));

    const placeholders = order.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT n.*,
          (SELECT COUNT(*) FROM sources s
           WHERE s.notebook_id = n.id
             AND lower(s.name) NOT LIKE '%readme%') as source_count
         FROM notebooks n
         WHERE n.id IN (${placeholders})`,
      )
      .all(...order) as Array<{
      id: string;
      title: string;
      updated_at: string;
      source_count: number;
    }>;

    const byId = new Map(rows.map((n) => [n.id, n]));
    const payload = order
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((nb) => {
        const manifestEntry = manifestById.get(nb.id);
        return {
          ...nb,
          documents: getNotebookDocumentNames(db, nb.id, manifestEntry),
          manifestDescription: manifestEntry?.description,
        };
      });

    return NextResponse.json(payload);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
