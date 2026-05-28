import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import {
  clientSessionCookieOptions,
  generateClientSessionId,
  getClientIp,
  getClientSessionIdFromRequest,
} from "@/lib/client-session";
import { readGuestLabelFromCookie } from "@/lib/site-gate";
import { ensureBuiltinDocuments, ensureBuiltinNotebooks } from "@/lib/auto-seed";
import { getDb } from "@/lib/db";
import { generateGroundedReply } from "@/lib/chat";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  ensureBuiltinNotebooks();
  await ensureBuiltinDocuments();

  const body = await request.json().catch(() => ({}));
  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  let clientSessionId = getClientSessionIdFromRequest(request);
  const newGuestSession = !clientSessionId;
  if (!clientSessionId) clientSessionId = generateClientSessionId();

  const clientIp = getClientIp(request);
  const guestLabel = readGuestLabelFromCookie(request.headers.get("cookie"));

  const db = getDb();
  const notebook = db
    .prepare(`SELECT id FROM notebooks WHERE id = ?`)
    .get(params.id);
  if (!notebook) {
    return NextResponse.json({ error: "Notebook not found" }, { status: 404 });
  }

  try {
    const historyRows = db
      .prepare(
        `SELECT role, content FROM messages
         WHERE notebook_id = ? AND client_session_id = ?
         ORDER BY created_at ASC`,
      )
      .all(params.id, clientSessionId) as {
      role: "user" | "assistant";
      content: string;
    }[];

    const now = new Date().toISOString();
    const userMsgId = uuidv4();
    db.prepare(
      `INSERT INTO messages (id, notebook_id, role, content, citations, created_at, client_session_id, client_ip, guest_label)
       VALUES (?, ?, 'user', ?, NULL, ?, ?, ?, ?)`,
    ).run(
      userMsgId,
      params.id,
      message,
      now,
      clientSessionId,
      clientIp,
      guestLabel ?? null,
    );

    const { content, citations } = await generateGroundedReply(
      params.id,
      message,
      historyRows,
    );

    const assistantMsgId = uuidv4();
    const assistantNow = new Date().toISOString();
    db.prepare(
      `INSERT INTO messages (id, notebook_id, role, content, citations, created_at, client_session_id, client_ip, guest_label)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)`,
    ).run(
      assistantMsgId,
      params.id,
      content,
      citations.length ? JSON.stringify(citations) : null,
      assistantNow,
      clientSessionId,
      clientIp,
      guestLabel ?? null,
    );

    db.prepare(`UPDATE notebooks SET updated_at = ? WHERE id = ?`).run(
      assistantNow,
      params.id,
    );

    const res = NextResponse.json({
      userMessage: { id: userMsgId, role: "user", content: message, created_at: now },
      assistantMessage: {
        id: assistantMsgId,
        role: "assistant",
        content,
        citations,
        created_at: assistantNow,
      },
    });

    if (newGuestSession) {
      res.cookies.set(clientSessionCookieOptions(clientSessionId));
    }

    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
