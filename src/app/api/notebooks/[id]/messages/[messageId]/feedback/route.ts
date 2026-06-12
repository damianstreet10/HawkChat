import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { getClientSessionIdFromRequest } from "@/lib/client-session";
import { getDb } from "@/lib/db";
import { isMessageFeedback } from "@/lib/message-feedback";

type Params = { params: { id: string; messageId: string } };

export async function POST(request: Request, { params }: Params) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const clientSessionId = getClientSessionIdFromRequest(request);
  if (!clientSessionId) {
    return NextResponse.json({ error: "Session required" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isMessageFeedback(body.feedback)) {
    return NextResponse.json(
      { error: "feedback must be helpful or not_helpful" },
      { status: 400 },
    );
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, role, client_session_id
       FROM messages
       WHERE id = ? AND notebook_id = ?`,
    )
    .get(params.messageId, params.id) as
    | { id: string; role: string; client_session_id: string | null }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  if (row.role !== "assistant") {
    return NextResponse.json(
      { error: "Feedback only applies to assistant replies" },
      { status: 400 },
    );
  }
  if (row.client_session_id !== clientSessionId) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const feedbackAt = new Date().toISOString();
  db.prepare(
    `UPDATE messages SET feedback = ?, feedback_at = ? WHERE id = ?`,
  ).run(body.feedback, feedbackAt, params.messageId);

  return NextResponse.json({
    feedback: body.feedback,
    feedback_at: feedbackAt,
  });
}
