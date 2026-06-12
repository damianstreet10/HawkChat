"use client";

import Link from "next/link";
import { notebookCardDescription } from "@/lib/notebook-description";
import { isNotebookDisabled } from "@/lib/disabled-notebooks";

type NotebookRow = {
  id: string;
  title: string;
  source_count: number;
  documents?: string[];
  manifestDescription?: string;
};

type EventInfo = {
  slug: string;
  title: string;
  manifestDescription?: string | null;
};

export function EventHome({
  event,
  loading = false,
  loadError = null,
  notebooks = [],
  onRetry,
}: {
  event: EventInfo;
  loading?: boolean;
  loadError?: string | null;
  notebooks?: NotebookRow[];
  onRetry?: () => void;
}) {
  return (
    <section className="hawk-card mx-auto max-w-lg p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-orange">
        Tournament space
      </p>
      <h2 className="font-display mt-3 text-2xl font-bold uppercase tracking-wide text-hawk-50">
        {event.title}
      </h2>
      {event.manifestDescription && (
        <p className="mt-3 text-sm leading-relaxed text-hawk-200">
          {event.manifestDescription}
        </p>
      )}
      <p className="mt-4 text-sm text-hawk-300">
        Choose a notebook. Answers only use documents for this tournament.
      </p>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-orange/40 bg-orange/10 px-4 py-3 text-sm text-orange-light">
          <p>{loadError}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="hawk-btn-secondary mt-3 px-4 py-2 text-xs"
            >
              Retry
            </button>
          )}
        </div>
      ) : loading ? (
        <p className="mt-6 animate-pulse text-sm text-hawk-400">
          Preparing tournament documents…
        </p>
      ) : notebooks.length === 0 ? (
        <p className="mt-6 text-sm text-hawk-400">
          No notebooks for this event yet. An admin can add PDFs under{" "}
          <span className="font-mono text-hawk-200">
            seed/events/{event.slug}/
          </span>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-3 text-left">
          {notebooks.map((nb) => {
            const disabled = isNotebookDisabled(nb.id);
            const href = `/notebook/${nb.id}?event=${encodeURIComponent(event.slug)}`;
            const card = (
              <>
                <h3 className="font-display text-lg font-bold text-hawk-50">
                  {nb.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-hawk-300">
                  {notebookCardDescription(
                    nb.id,
                    nb.documents ?? [],
                    nb.source_count,
                    nb.manifestDescription,
                  )}
                  {disabled && (
                    <span className="mt-1 block text-xs text-hawk-500">
                      Coming soon
                    </span>
                  )}
                </p>
              </>
            );

            return (
              <li key={nb.id}>
                {disabled ? (
                  <div
                    className="hawk-card block cursor-not-allowed p-4 opacity-50"
                    aria-disabled="true"
                  >
                    {card}
                  </div>
                ) : (
                  <Link
                    href={href}
                    className="hawk-card block p-4 transition hover:border-orange/50 hover:shadow-hawk-glow"
                  >
                    {card}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
