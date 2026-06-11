import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { ensureBuiltinDocuments } from "@/lib/auto-seed";
import { authErrorResponse, requireAuth, requireNotebookManage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getNotebookDocumentNames } from "@/lib/notebook-documents";
import { readSeedManifest } from "@/lib/seed-manifest";

export async function GET(request: Request) {
  try {
    requireAuth(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
  await ensureBuiltinDocuments();
  const db = getDb();
  let notebooks = db
    .prepare(
      `SELECT n.*,
        (SELECT COUNT(*) FROM sources s
         WHERE s.notebook_id = n.id
           AND lower(s.name) NOT LIKE '%readme%') as source_count
       FROM notebooks n
       ORDER BY n.updated_at DESC`,
    )
    .all() as Array<{
    id: string;
    title: string;
    updated_at: string;
    source_count: number;
  }>;

  const manifest = readSeedManifest();
  const manifestById = new Map(manifest?.map((n) => [n.notebookId, n]) ?? []);

  if (process.env.HAWKCHAT_LAN_DEMO === "true" && manifest?.length) {
    const order = manifest.map((n) => n.notebookId);
    const byId = new Map(notebooks.map((n) => [n.id, n]));
    notebooks = order
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }

  const payload = notebooks.map((nb) => {
    const manifestEntry = manifestById.get(nb.id);
    return {
      ...nb,
      documents: getNotebookDocumentNames(db, nb.id, manifestEntry),
      manifestDescription: manifestEntry?.description,
    };
  });

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  try {
    requireNotebookManage(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "Untitled notebook";

  const id = uuidv4();
  const now = new Date().toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO notebooks (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
  ).run(id, title, now, now);

  return NextResponse.json({ id, title, created_at: now, updated_at: now });
}
