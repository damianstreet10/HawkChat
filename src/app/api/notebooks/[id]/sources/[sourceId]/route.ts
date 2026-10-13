/**
 * DELETE /api/notebooks/[id]/sources/[sourceId] — remove a source and its chunks.
 * Callers: sources panel. Debug upload-permission 403 or source not under notebook.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireUpload } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireNotebookAccess } from "@/lib/event-access";

type Params = { params: { id: string; sourceId: string } };

/** Upload permission + access: delete source chunks then the source row. */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = requireUpload(request);
    requireNotebookAccess(user, params.id);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM chunks WHERE source_id = ?`).run(params.sourceId);
    db.prepare(
      `DELETE FROM sources WHERE id = ? AND notebook_id = ?`,
    ).run(params.sourceId, params.id);
    db.prepare(`UPDATE notebooks SET updated_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      params.id,
    );
  });
  tx();
  return NextResponse.json({ ok: true });
}
