"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MESSAGE_FEEDBACK_LABELS,
  type MessageFeedback,
} from "@/lib/message-feedback";

type ExchangeRow = {
  question_id: string;
  notebook_id: string;
  notebook_title: string;
  question: string;
  answer: string;
  client_ip: string | null;
  guest_label: string | null;
  asked_at: string;
  answer_id: string;
  feedback: MessageFeedback | null;
  feedback_at: string | null;
};

function feedbackBadge(feedback: MessageFeedback | null) {
  if (feedback === "helpful") {
    return (
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
        {MESSAGE_FEEDBACK_LABELS.helpful}
      </span>
    );
  }
  if (feedback === "not_helpful") {
    return (
      <span className="rounded-full border border-orange/40 bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange-light">
        {MESSAGE_FEEDBACK_LABELS.not_helpful}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-hawk-600 bg-hawk-800 px-2 py-0.5 text-xs text-hawk-400">
      No feedback
    </span>
  );
}

export function EventActivityView({
  apiUrl,
  description,
}: {
  apiUrl: string;
  description: string;
}) {
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl);
    if (res.status === 401 || res.status === 403) {
      setError("Sign in with an admin or monitor account.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load activity.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setExchanges(data.exchanges ?? []);
    setError(null);
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const helpfulCount = exchanges.filter((e) => e.feedback === "helpful").length;
  const notHelpfulCount = exchanges.filter(
    (e) => e.feedback === "not_helpful",
  ).length;
  const noFeedbackCount = exchanges.filter((e) => !e.feedback).length;

  if (loading) return <p className="text-hawk-400">Loading…</p>;
  if (error) return <p className="text-hawk-200">{error}</p>;

  return (
    <>
      <p className="mb-4 text-sm text-hawk-300">{description}</p>
      {exchanges.length > 0 && (
        <p className="mb-6 text-sm text-hawk-400">
          {helpfulCount} helpful · {notHelpfulCount} not helpful ·{" "}
          {noFeedbackCount} awaiting feedback
        </p>
      )}
      {exchanges.length === 0 ? (
        <p className="text-hawk-400">No chat exchanges yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hawk-600">
          <table className="w-full text-left text-sm">
            <thead className="bg-hawk-800 text-xs font-bold uppercase tracking-widest text-orange">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Notebook</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Answer</th>
                <th className="px-4 py-3">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hawk-700">
              {exchanges.map((row) => (
                <tr key={row.answer_id} className="bg-hawk-900/50 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-hawk-300">
                    {new Date(row.asked_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-hawk-200">
                    {row.notebook_title}
                  </td>
                  <td className="px-4 py-3 text-hawk-100">
                    <div>{row.guest_label ?? "—"}</div>
                    {row.client_ip && (
                      <div className="mt-1 font-mono text-xs text-orange-light">
                        {row.client_ip}
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-hawk-100">
                    {row.question}
                  </td>
                  <td className="max-w-md px-4 py-3 text-hawk-300">
                    {row.answer.length > 280
                      ? `${row.answer.slice(0, 280)}…`
                      : row.answer}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {feedbackBadge(row.feedback)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
