import { normalizeCitations } from "@/lib/citations";
import type { Citation } from "@/lib/db";

export function CitationList({ citations }: { citations: Citation[] }) {
  const docs = normalizeCitations(citations);
  if (!docs.length) return null;

  return (
    <div className="mt-4 border-t border-hawk-600 pt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange/80">
        Sources used ({docs.length})
      </p>
      <ul className="space-y-2">
        {docs.map((c) => (
          <li
            key={c.sourceId}
            className="rounded-lg border border-hawk-600 bg-hawk-800/80 px-3 py-2 text-sm"
          >
            <span className="font-medium text-orange-light">{c.sourceName}</span>
            <p className="mt-1 leading-snug text-hawk-200">{c.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
