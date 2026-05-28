"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useSession } from "@/hooks/useSession";

type QuestionRow = {
  id: string;
  notebook_id: string;
  notebook_title: string;
  content: string;
  client_ip: string | null;
  client_session_id: string | null;
  guest_label: string | null;
  created_at: string;
};

export default function ActivityPage() {
  const session = useSession();
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess =
    session.authenticated && session.permissions.canViewActivity;

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/activity");
    if (res.status === 401 || res.status === 403) {
      setError("Sign in with an admin or monitor account to view activity.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load activity.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setQuestions(data.questions ?? []);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Sign in with an admin or monitor account to view activity.");
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

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Guest questions
        </h2>
        <p className="mb-6 text-sm text-hawk-300">
          All user questions across notebooks. Guests only see their own chat on
          their device. Refreshes every 15 seconds.
        </p>

        {session.loading || loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link href="/login/staff?from=/admin/activity" className="hawk-btn-primary px-5 py-2 text-sm">
              Staff sign in
            </Link>
          </div>
        ) : questions.length === 0 ? (
          <p className="text-hawk-400">No questions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hawk-600">
            <table className="w-full text-left text-sm">
              <thead className="bg-hawk-800 text-xs font-bold uppercase tracking-widest text-orange">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Notebook</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Question</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hawk-700">
                {questions.map((q) => (
                  <tr key={q.id} className="bg-hawk-900/50">
                    <td className="whitespace-nowrap px-4 py-3 text-hawk-300">
                      {new Date(q.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-hawk-200">
                      {q.notebook_title}
                    </td>
                    <td className="px-4 py-3 text-hawk-100">
                      {q.guest_label ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-orange-light">
                      {q.client_ip ?? "—"}
                    </td>
                    <td className="max-w-md px-4 py-3 text-hawk-100">
                      {q.content}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
