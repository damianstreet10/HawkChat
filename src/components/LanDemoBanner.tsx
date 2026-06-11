"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { notebookCardDescription } from "@/lib/notebook-description";
import { isNotebookDisabled } from "@/lib/disabled-notebooks";

const ENV_LAN_URL = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_URL ?? "";
const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

const SEED_ORDER = [
  "useful-resources",
  "hardware-support",
  "software-support",
  "kit-quirks",
  "builtin-notebook",
];

type NotebookRow = {
  id: string;
  title: string;
  source_count: number;
  documents?: string[];
  manifestDescription?: string;
};

export function LanDemoBanner({
  loading = false,
  loadError = null,
  notebooks = [],
  onRetry,
}: {
  loading?: boolean;
  loadError?: string | null;
  notebooks?: NotebookRow[];
  onRetry?: () => void;
}) {
  const [lanUrl, setLanUrl] = useState(ENV_LAN_URL);

  useEffect(() => {
    fetch("/api/lan-url")
      .then((r) => r.json())
      .then((data: { url: string | null }) => {
        if (data.url) setLanUrl(data.url);
      })
      .catch(() => {});
  }, []);

  if (!LAN_DEMO) return null;

  const showLanLink =
    lanUrl && !lanUrl.includes("0.0.0.0") && !lanUrl.includes("localhost");

  const sorted = [...notebooks].sort((a, b) => {
    const ai = SEED_ORDER.indexOf(a.id);
    const bi = SEED_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <section className="hawk-card mx-auto max-w-lg p-8 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-orange">
        Hawk-Eye support chat
      </p>
      {showLanLink && (
        <p className="mt-3 font-mono text-sm text-hawk-300">
          <a href={lanUrl} className="text-orange-light hover:underline">
            {lanUrl}
          </a>
        </p>
      )}
      {!showLanLink && (
        <p className="mt-3 text-sm text-hawk-300">
          On this Mac:{" "}
          <span className="font-mono text-hawk-100">http://localhost:3000</span>
          <br />
          On your phone (same Wi‑Fi): use your Mac&apos;s IP, e.g.{" "}
          <span className="font-mono text-hawk-100">http://192.168.x.x:3000</span>
        </p>
      )}
      <p className="mt-4 text-sm leading-relaxed text-hawk-200">
        Choose a notebook. Each has its own documents — answers only use that
        notebook&apos;s PDFs.
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
          Preparing documents (first visit may take a minute)…
        </p>
      ) : sorted.length === 0 ? (
        <p className="mt-6 text-sm text-hawk-400">No notebooks available yet.</p>
      ) : (
        <ul className="mt-6 space-y-3 text-left">
          {sorted.map((nb) => {
            const disabled = isNotebookDisabled(nb.id);
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
                    title="Not available yet"
                  >
                    {card}
                  </div>
                ) : (
                  <Link
                    href={`/notebook/${nb.id}`}
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
