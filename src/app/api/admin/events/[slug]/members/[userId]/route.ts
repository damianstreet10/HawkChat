/**
 * DELETE /api/admin/events/[slug]/members/[userId] — remove an event member.
 * Callers: event members admin. Debug requireEventEditor or 404 when user
 * was never enrolled on this event.
 */
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireEventEditor } from "@/lib/event-ownership";

type Params = { params: { slug: string; userId: string } };

/** Event editor: delete event_members row for userId. */
export async function DELETE(request: Request, { params }: Params) {
  let event;
  try {
    ({ event } = requireEventEditor(request, params.slug));
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  const result = db
    .prepare(
      `DELETE FROM event_members WHERE event_id = ? AND user_id = ?`,
    )
    .run(event.id, params.userId);

  if (result.changes === 0) {
    return NextResponse.json(
      { error: "Member not found on this event" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
