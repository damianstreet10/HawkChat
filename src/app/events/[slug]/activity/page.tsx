"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EventActivityView } from "@/components/EventActivityView";
import { EventShell } from "@/components/EventShell";
import { useSession } from "@/hooks/useSession";

export default function EventActivityPage() {
  const params = useParams();
  const slug = params.slug as string;
  const session = useSession();
  const [title, setTitle] = useState(slug);

  useEffect(() => {
    fetch(`/api/events/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.title) setTitle(d.title);
      })
      .catch(() => {});
  }, [slug]);

  const canAccess =
    session.authenticated && session.permissions.canViewActivity;

  return (
    <div className="hawk-page min-h-screen">
      <EventShell eventSlug={slug} eventTitle={title} activeTab="activity" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Chat feedback
        </h2>
        {!session.loading && !canAccess ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">
              Monitor or admin access required.
            </p>
            <Link
              href={`/login/staff?from=/events/${slug}/activity`}
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : (
          <EventActivityView
            apiUrl={`/api/events/${slug}/admin/activity`}
            description={
              slug === "world-cup-2026"
                ? "Live guest questions and helpfulness ratings from the World Cup LAN site. Refreshes every 15 seconds."
                : "Questions and helpfulness ratings for this tournament's notebooks. Refreshes every 15 seconds."
            }
          />
        )}
      </main>
    </div>
  );
}
