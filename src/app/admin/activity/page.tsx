"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { EventActivityView } from "@/components/EventActivityView";
import { useSession } from "@/hooks/useSession";

export default function ActivityPage() {
  const session = useSession();
  const canAccess =
    session.authenticated && session.permissions.canViewActivity;

  return (
    <div className="hawk-page min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          World Cup chat feedback
        </h2>
        <p className="mb-6 text-sm text-hawk-400">
          LAN demo only. For tournaments, open{" "}
          <Link href="/events" className="text-orange hover:underline">
            Events
          </Link>{" "}
          and choose a tournament.
        </p>

        {session.loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : !canAccess ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">
              Sign in with an admin or monitor account to view activity.
            </p>
            <Link
              href="/login/staff?from=/admin/activity"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : (
          <EventActivityView
            apiUrl="/api/admin/activity"
            description="Guest questions on the World Cup LAN notebooks. Refreshes every 15 seconds."
          />
        )}
      </main>
    </div>
  );
}
