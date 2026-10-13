"use client";

/**
 * Single project/event home (`/events/[slug]`).
 * Debug missing event payload, notebook list, or chatOpen/timeStatus — loads
 * `/api/events/[slug]` then renders `EventShell` + `EventHome`.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventHome } from "@/components/EventHome";
import { EventShell } from "@/components/EventShell";
import { useSession } from "@/hooks/useSession";

type EventPayload = {
  slug: string;
  title: string;
  manifestDescription?: string | null;
  timeStatus?: "active" | "upcoming" | "past";
  chatOpen?: boolean;
  dateRangeLabel?: string | null;
};

type NotebookRow = {
  id: string;
  title: string;
  source_count: number;
  documents?: string[];
  manifestDescription?: string;
};

export default function EventPage() {
  const params = useParams();
  const slug = params.slug as string;
  const session = useSession();
  const [event, setEvent] = useState<EventPayload | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const eventRes = await fetch(`/api/events/${slug}`);
      if (eventRes.status === 401) {
        throw new Error("Sign in with your email to open this project.");
      }
      if (eventRes.status === 403) {
        throw new Error("You are not a member of this project.");
      }
      if (!eventRes.ok) {
        throw new Error("Could not load this project.");
      }
      const eventData = await eventRes.json();
      setEvent({
        slug: eventData.slug,
        title: eventData.title,
        manifestDescription:
          eventData.manifestDescription ?? eventData.description,
        timeStatus: eventData.timeStatus,
        chatOpen: eventData.chatOpen,
        dateRangeLabel: eventData.dateRangeLabel,
      });

      const nbRes = await fetch(`/api/events/${slug}/notebooks`);
      if (!nbRes.ok) {
        throw new Error("Could not load project notebooks.");
      }
      const nbData = await nbRes.json();
      setNotebooks(Array.isArray(nbData) ? nbData : []);
    } catch (err) {
      setEvent(null);
      setNotebooks([]);
      setLoadError(
        err instanceof Error ? err.message : "Could not load project.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!session.loading) load();
  }, [session.loading, load]);

  return (
    <div className="hawk-page">
      <EventShell
        eventSlug={slug}
        eventTitle={event?.title}
        activeTab="notebooks"
      />
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col items-center justify-center px-6 py-12">
        {event ? (
          <EventHome
            event={event}
            loading={loading}
            loadError={loadError}
            notebooks={notebooks}
            onRetry={load}
          />
        ) : loading ? (
          <p className="text-hawk-400">Loading project…</p>
        ) : (
          <div className="hawk-card-muted max-w-md p-8 text-center">
            <p className="text-hawk-200">{loadError ?? "Project not found."}</p>
          </div>
        )}
      </main>
    </div>
  );
}
