import type { Citation } from "./db";

/** One citation per document (fixes legacy messages that stored one per chunk). */
export function normalizeCitations(citations: Citation[]): Citation[] {
  const bySource = new Map<string, Citation>();

  for (const c of citations) {
    if (c.sourceName.toLowerCase().includes("readme")) continue;
    const existing = bySource.get(c.sourceId);
    if (!existing || c.excerpt.length > existing.excerpt.length) {
      bySource.set(c.sourceId, c);
    }
  }

  return Array.from(bySource.values());
}
