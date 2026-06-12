"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { useSession } from "@/hooks/useSession";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  notebookCount?: number;
};

export default function AdminEventsPage() {
  const session = useSession();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmails, setMemberEmails] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const canAccess =
    session.authenticated && session.user?.role === "admin";

  const load = useCallback(async () => {
    const res = await fetch("/api/events");
    if (!res.ok) {
      setError("Could not load events.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Admin sign in required.");
      setLoading(false);
      return;
    }
    load();
  }, [session.loading, canAccess, load]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMessage(null);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        description,
        memberEmails: memberEmails
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateMessage(data.error ?? "Could not create event.");
      return;
    }

    setCreateMessage(
      `Created "${data.title}". Members added: ${(data.membersAdded ?? []).join(", ") || "none"}.` +
        (data.membersMissing?.length
          ? ` Missing users: ${data.membersMissing.join(", ")} — create them first via Users API or HAWKCHAT_EVENT_USERS.`
          : "") +
        ` Next: add ${data.setupHint}`,
    );
    setSlug("");
    setTitle("");
    setDescription("");
    setMemberEmails("");
    load();
  }

  return (
    <div className="hawk-page min-h-screen">
      <StaffPortalHeader title="Manage events" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Manage events
        </h2>
        <p className="mb-8 text-sm text-hawk-300">
          Create tournament spaces with their own notebooks. Event members sign in
          at Staff sign in and land directly in their event — the World Cup LAN
          demo at <span className="text-hawk-100">/</span> is unchanged.
        </p>

        {session.loading || loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link
              href="/login/staff?from=/admin/events"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={createEvent} className="hawk-card mb-10 space-y-4 p-6">
              <h3 className="font-display text-lg font-bold text-hawk-50">
                Create event
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">Slug</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                    placeholder="champions-league"
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="UEFA Champions League 2026"
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Member emails (comma or newline)
                </label>
                <textarea
                  value={memberEmails}
                  onChange={(e) => setMemberEmails(e.target.value)}
                  rows={2}
                  placeholder="test@hawkeyeinnovations.com"
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              {createMessage && (
                <p className="text-sm text-hawk-200">{createMessage}</p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="hawk-btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create event"}
              </button>
            </form>

            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-orange">
              Existing events
            </h3>
            {events.length === 0 ? (
              <p className="text-hawk-400">No events yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="hawk-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-display text-lg font-bold text-hawk-50">
                          {event.title}
                        </h4>
                        <p className="mt-1 font-mono text-xs text-hawk-400">
                          /events/{event.slug}
                        </p>
                        {event.description && (
                          <p className="mt-2 text-sm text-hawk-300">
                            {event.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-hawk-400">
                          {event.notebookCount ?? 0} notebook(s) in manifest
                        </p>
                      </div>
                      <Link
                        href={`/events/${event.slug}`}
                        className="hawk-btn-secondary px-4 py-2 text-sm"
                      >
                        Open space
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}
