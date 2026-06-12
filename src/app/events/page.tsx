"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { useSession } from "@/hooks/useSession";
import { isStaffPortalRole } from "@/lib/permissions";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  notebookCount?: number;
};

export default function EventsPickerPage() {
  const router = useRouter();
  const session = useSession();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.loading) return;
    if (!session.authenticated) {
      router.replace("/login/staff?from=/events");
      return;
    }

    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        const list = data.events ?? [];
        setEvents(list);

        const isStaff =
          session.user && isStaffPortalRole(session.user.role);
        if (!isStaff && list.length === 1) {
          router.replace(`/events/${list[0].slug}`);
        }
      })
      .catch(() => setError("Could not load events."))
      .finally(() => setLoading(false));
  }, [session.loading, session.authenticated, session.user, router]);

  return (
    <div className="hawk-page min-h-screen">
      <StaffPortalHeader title="All events" />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Choose an event
        </h2>
        <p className="mb-8 text-sm text-hawk-300">
          Select an event to review notebooks, guest chat feedback, and kit
          quirks. World Cup 2026 shows live data from the public site.
        </p>

        {loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <p className="text-orange-light">{error}</p>
        ) : events.length === 0 ? (
          <p className="text-hawk-400">No events available yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.slug}`}
                  className="hawk-card block p-5 transition hover:border-orange/50 hover:shadow-hawk-glow"
                >
                  <h3 className="font-display text-lg font-bold text-hawk-50">
                    {event.title}
                  </h3>
                  {event.description && (
                    <p className="mt-2 text-sm text-hawk-300">
                      {event.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-hawk-400">
                    {event.notebookCount ?? 0} notebook(s)
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
