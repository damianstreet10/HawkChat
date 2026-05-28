"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useSession } from "@/hooks/useSession";

type QuirkReport = {
  id: string;
  reporter_name: string | null;
  kit_name: string;
  asset_tag: string | null;
  quirk_details: string;
  extra_notes: string | null;
  client_ip: string | null;
  guest_label: string | null;
  created_at: string;
};

export default function AdminQuirksPage() {
  const session = useSession();
  const [reports, setReports] = useState<QuirkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess =
    session.authenticated && session.permissions.canViewActivity;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/quirks");
    if (res.status === 401 || res.status === 403) {
      setError("Sign in with an admin or monitor account.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load reports.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReports(data.reports ?? []);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Sign in with an admin or monitor account.");
      setLoading(false);
      return;
    }
    load();
  }, [session.loading, canAccess, load]);

  useEffect(() => {
    if (session.loading || !canAccess) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [session.loading, canAccess, load]);

  return (
    <div className="hawk-page min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Kit Quirks reports
        </h2>
        <p className="mb-6 text-sm text-hawk-300">
          Submissions from the Kit Quirks notebook. Refreshes every 15 seconds.
        </p>

        {session.loading || loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link
              href="/login/staff?from=/admin/quirks"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-hawk-400">No reports yet.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => (
              <li key={r.id} className="hawk-card p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-lg font-bold text-hawk-50">
                    {r.kit_name}
                    {r.asset_tag && (
                      <span className="ml-2 font-mono text-sm font-normal text-orange-light">
                        {r.asset_tag}
                      </span>
                    )}
                  </p>
                  <time className="text-xs text-hawk-400">
                    {new Date(r.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="mb-2 text-sm text-hawk-300">
                  <span className="text-hawk-500">From:</span>{" "}
                  {r.reporter_name || r.guest_label || "—"}
                  {r.client_ip && (
                    <span className="ml-2 font-mono text-xs text-hawk-500">
                      {r.client_ip}
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-hawk-100">
                  {r.quirk_details}
                </p>
                {r.extra_notes && (
                  <p className="mt-3 whitespace-pre-wrap border-t border-hawk-600 pt-3 text-sm text-hawk-300">
                    <span className="font-medium text-hawk-400">Notes: </span>
                    {r.extra_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
