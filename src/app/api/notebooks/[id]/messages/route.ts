import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { getClientSessionIdFromRequest } from "@/lib/client-session";
import { normalizeCitations } from "@/lib/citations";
import { getDb, type Citation } from "@/lib/db";

type Params = { params: { id: string } };

export async function GET(request: Request, { params }: Params) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const clientSessionId = getClientSessionIdFromRequest(request);
  if (!clientSessionId) {
    return NextResponse.json([]);
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, notebook_id, role, content, citations, created_at
       FROM messages
       WHERE notebook_id = ? AND client_session_id = ?
       ORDER BY created_at ASC`,
    )
    .all(params.id, clientSessionId) as Array<{
    id: string;
    notebook_id: string;
    role: string;
    content: string;
    citations: string | null;
    created_at: string;
  }>;

  const messages = rows.map((r) => {
    const raw = r.citations
      ? (JSON.parse(r.citations) as Citation[])
      : null;
    return {
      ...r,
      citations: raw ? normalizeCitations(raw) : null,
    };
  });

  return NextResponse.json(messages);
}
