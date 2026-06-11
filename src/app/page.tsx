"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LanDemoBanner } from "@/components/LanDemoBanner";
import { useSession } from "@/hooks/useSession";
import { notebookCardDescription } from "@/lib/notebook-description";
import { isNotebookDisabled } from "@/lib/disabled-notebooks";

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

type NotebookRow = {
  id: string;
  title: string;
  updated_at: string;
  source_count: number;
  documents?: string[];
  manifestDescription?: string;
};

export default function HomePage() {
  const session = useSession();
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = session.permissions.canManageNotebooks && !LAN_DEMO;

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/notebooks");
      if (!res.ok) {
        throw new Error(
          res.status === 401
            ? "Site password required — open /login and sign in first"
            : res.status === 404
              ? "API not found — restart with: npm run dev:fresh"
              : `Could not load notebooks (${res.status})`,
        );
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid server response — try npm run dev:fresh");
      }
      setNotebooks(data);
    } catch (err) {
      setNotebooks([]);
      setLoadError(
        err instanceof Error ? err.message : "Could not load notebooks",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session.loading) load();
  }, [session.loading]);

  async function createNotebook() {
    setCreating(true);
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New notebook" }),
    });
    const nb = await res.json();
    setCreating(false);
    if (!res.ok) return;
    window.location.href = `/notebook/${nb.id}`;
  }

  if (LAN_DEMO) {
    return (
      <div className="hawk-page">
        <AppHeader />
        <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center justify-center px-6 py-12">
          <LanDemoBanner
            loading={loading}
            loadError={loadError}
            notebooks={notebooks}
            onRetry={load}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="hawk-page">
      <AppHeader>
        {canManage && (
          <button
            onClick={createNotebook}
            disabled={creating}
            className="hawk-btn-primary px-5 py-2 text-sm disabled:opacity-60"
          >
            {creating ? "Creating…" : "+ New notebook"}
          </button>
        )}
      </AppHeader>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="hawk-card mb-10 p-8">
          <span className="hawk-badge mb-4">HAWK-EYE INNOVATIONS</span>
          <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
            Grounded intelligence from your sources
          </h2>
          <p className="max-w-2xl leading-relaxed text-hawk-200">
            {canManage
              ? "Upload PDFs and documents into a notebook, then ask questions with answers cited from your material."
              : "Open a shared notebook and ask questions."}
          </p>
        </section>

        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-orange">
          Notebooks
        </h3>

        {loading ? (
          <p className="text-hawk-300">Loading…</p>
        ) : notebooks.length === 0 ? (
          <div className="hawk-card-muted p-12 text-center">
            <p className="mb-4 text-hawk-200">No notebooks yet.</p>
            {canManage && (
              <button
                onClick={createNotebook}
                className="hawk-btn-primary px-5 py-2 text-sm"
              >
                Create your first notebook
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {notebooks.map((nb) => {
              const disabled = isNotebookDisabled(nb.id);
              const card = (
                <>
                  <h4 className="font-display text-lg font-bold text-hawk-50">
                    {nb.title}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-hawk-300">
                    {notebookCardDescription(
                      nb.id,
                      nb.documents ?? [],
                      nb.source_count,
                      nb.manifestDescription,
                    )}
                    {disabled ? (
                      <span className="mt-1 block text-xs text-hawk-500">
                        Coming soon
                      </span>
                    ) : (
                      nb.id !== "kit-quirks" && (
                        <>
                          {" "}
                          · Updated{" "}
                          {new Date(nb.updated_at).toLocaleDateString()}
                        </>
                      )
                    )}
                  </p>
                </>
              );

              return (
                <li key={nb.id}>
                  {disabled ? (
                    <div
                      className="hawk-card block cursor-not-allowed p-5 opacity-50"
                      aria-disabled="true"
                      title="Not available yet"
                    >
                      {card}
                    </div>
                  ) : (
                    <Link
                      href={`/notebook/${nb.id}`}
                      className="hawk-card block p-5 transition hover:border-orange/50 hover:shadow-hawk-glow"
                    >
                      {card}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
