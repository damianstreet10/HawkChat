import { NextResponse } from "next/server";
import { authErrorResponse, requireUpload } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Params = { params: { id: string; sourceId: string } };

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireUpload(request);
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
