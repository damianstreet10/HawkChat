import { getDb, type Citation, type Chunk } from "./db";
import { cosineSimilarity, embedText } from "./embeddings";

export type RetrievedChunk = Chunk & {
  sourceName: string;
  score: number;
};

const MIN_SCORE = 0.32;
const MAX_CHUNKS_TOTAL = 10;
const MAX_CHUNKS_PER_SOURCE = 2;

export async function retrieveChunks(
  notebookId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const queryEmbedding = await embedText(query);

  const rows = db
    .prepare(
      `SELECT c.id, c.source_id, c.notebook_id, c.content, c.embedding, c.chunk_index,
              s.name as source_name
       FROM chunks c
       JOIN sources s ON s.id = c.source_id
       WHERE c.notebook_id = ?
         AND lower(s.name) NOT LIKE '%readme%'`,
    )
    .all(notebookId) as Array<{
    id: string;
    source_id: string;
    notebook_id: string;
    content: string;
    embedding: string;
    chunk_index: number;
    source_name: string;
  }>;

  const scored: RetrievedChunk[] = rows
    .map((row) => {
      const embedding = JSON.parse(row.embedding) as number[];
      return {
        id: row.id,
        source_id: row.source_id,
        notebook_id: row.notebook_id,
        content: row.content,
        embedding,
        chunk_index: row.chunk_index,
        sourceName: row.source_name,
        score: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  return diversifyChunks(scored);
}

/** Prefer top chunks overall, but at most N per document. */
function diversifyChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const picked: RetrievedChunk[] = [];
  const perSource = new Map<string, number>();

  for (const chunk of chunks) {
    if (picked.length >= MAX_CHUNKS_TOTAL) break;
    const count = perSource.get(chunk.source_id) ?? 0;
    if (count >= MAX_CHUNKS_PER_SOURCE) continue;
    perSource.set(chunk.source_id, count + 1);
    picked.push(chunk);
  }

  return picked;
}

export function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] Source: "${c.sourceName}"\n"""\n${c.content}\n"""`,
    )
    .join("\n\n");
}

/** One card per document (best-matching excerpt), not one per chunk. */
export function chunksToCitations(chunks: RetrievedChunk[]): Citation[] {
  const bySource = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const existing = bySource.get(chunk.source_id);
    if (!existing || chunk.score > existing.score) {
      bySource.set(chunk.source_id, chunk);
    }
  }

  return Array.from(bySource.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => ({
      sourceId: c.source_id,
      sourceName: c.sourceName,
      excerpt:
        c.content.length > 320 ? c.content.slice(0, 317) + "…" : c.content,
      chunkIndex: c.chunk_index,
    }));
}
