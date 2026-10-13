/**
 * Compact list of document filenames on notebook cards.
 * Debug missing docs on cards — presentational only; parent supplies `documents`.
 */
export function NotebookDocumentList({
  documents,
  compact = false,
}: {
  documents: string[];
  compact?: boolean;
}) {
  if (documents.length === 0) return null;

  return (
    <ul
      className={`mt-2 space-y-0.5 ${compact ? "max-h-28" : "max-h-36"} overflow-y-auto`}
    >
      {documents.map((doc) => (
        <li
          key={doc}
          className="truncate font-mono text-xs text-hawk-400"
          title={doc}
        >
          · {doc}
        </li>
      ))}
    </ul>
  );
}
