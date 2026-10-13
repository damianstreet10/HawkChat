/**
 * GET /api/notebooks/[id] — notebook detail (+ chatOpen flag).
 * PATCH — rename (notebook-manage + access).
 * DELETE — delete notebook and related rows (notebook-manage + access).
 * Callers: notebook page. Debug requireNotebookAccess / chatOpen for monitors.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth, requireNotebookManage } from "@/lib/auth";
import { ensureBuiltinNotebook } from "@/lib/auto-seed";
import { getDb } from "@/lib/db";
import {
  canChatOnNotebook,
  requireNotebookAccess,
} from "@/lib/event-access";

type Params = { params: { id: string } };

/** Auth + notebook access: return notebook row and whether chat is allowed. */
export async function GET(request: Request, { params }: Params) {
  try {
    const user = requireAuth(request);
    requireNotebookAccess(user, params.id);
    ensureBuiltinNotebook();
    const db = getDb();
    const notebook = db
      .prepare(`SELECT * FROM notebooks WHERE id = ?`)
      .get(params.id);
    if (!notebook) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...notebook,
      chatOpen: canChatOnNotebook(user, params.id),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

/** Notebook-manage: update title. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = requireNotebookManage(request);
    requireNotebookAccess(user, params.id);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : null;
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(`UPDATE notebooks SET title = ?, updated_at = ? WHERE id = ?`)
    .run(title, now, params.id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: params.id, title, updated_at: now });
}

/** Notebook-manage: delete notebook, messages, sources, and chunks. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = requireNotebookManage(request);
    requireNotebookAccess(user, params.id);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM chunks WHERE notebook_id = ?`).run(params.id);
    db.prepare(`DELETE FROM messages WHERE notebook_id = ?`).run(params.id);
    db.prepare(`DELETE FROM sources WHERE notebook_id = ?`).run(params.id);
    db.prepare(`DELETE FROM notebooks WHERE id = ?`).run(params.id);
  });
  tx();
  return NextResponse.json({ ok: true });
}
