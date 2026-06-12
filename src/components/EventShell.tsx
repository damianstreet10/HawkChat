"use client";

import Link from "next/link";
import { StaffPortalHeader } from "./StaffPortalHeader";
import { useSession } from "@/hooks/useSession";

export type EventShellTab = "notebooks" | "activity" | "quirks";

export function EventShell({
  eventSlug,
  eventTitle,
  activeTab,
}: {
  eventSlug: string;
  eventTitle?: string;
  activeTab: EventShellTab;
}) {
  const session = useSession();
  const base = `/events/${eventSlug}`;

  const canMonitor =
    session.authenticated && session.permissions.canViewActivity;

  const tabs: Array<{ id: EventShellTab; label: string; href: string }> = [
    { id: "notebooks", label: "Notebooks", href: base },
  ];
  if (canMonitor) {
    tabs.push(
      { id: "activity", label: "Activity", href: `${base}/activity` },
      { id: "quirks", label: "Kit quirks", href: `${base}/quirks` },
    );
  }

  return (
    <>
      <StaffPortalHeader title={eventTitle ?? eventSlug} />
      <div className="border-b border-hawk-700 bg-hawk-950/80">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-6 py-3">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={
                activeTab === tab.id
                  ? "hawk-btn-primary px-4 py-2 text-sm"
                  : "hawk-btn-secondary px-4 py-2 text-sm"
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
