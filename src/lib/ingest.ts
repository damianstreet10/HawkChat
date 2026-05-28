import { v4 as uuidv4 } from "uuid";
import { getDb } from "./db";
import { chunkText } from "./chunking";
import { embedTexts } from "./embeddings";

export async function ingestSource(
  notebookId: string,
  name: string,
  type: string,
  contentText: string,
): Promise<{ sourceId: string; chunkCount: number }> {
  const db = getDb();
  const sourceId = uuidv4();
  const now = new Date().toISOString();

  const chunks = chunkText(contentText);
  if (chunks.length === 0) {
    throw new Error("No readable text found in this source.");
  }

  const embeddings = await embedTexts(chunks);

  const insertSource = db.prepare(
    `INSERT INTO sources (id, notebook_id, name, type, content_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertChunk = db.prepare(
    `INSERT INTO chunks (id, source_id, notebook_id, content, embedding, chunk_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const tx = db.transaction(() => {
    insertSource.run(
      sourceId,
      notebookId,
      name,
      type,
      contentText.slice(0, 500_000),
      now,
    );
    chunks.forEach((content, i) => {
      insertChunk.run(
        uuidv4(),
        sourceId,
        notebookId,
        content,
        JSON.stringify(embeddings[i]),
        i,
      );
    });
    db.prepare(`UPDATE notebooks SET updated_at = ? WHERE id = ?`).run(
      now,
      notebookId,
    );
  });

  tx();

  return { sourceId, chunkCount: chunks.length };
}
