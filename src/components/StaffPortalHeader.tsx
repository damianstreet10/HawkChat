"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { HawkLogo } from "./HawkLogo";
import { useSession } from "@/hooks/useSession";

export function StaffPortalHeader({ title }: { title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const onPicker = pathname === "/events";
  const onManageEvents = pathname === "/admin/events";
  const canManageEvents =
    session.authenticated && session.permissions.canManageUsers;

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/site-logout", { method: "POST" });
      session.refresh();
      router.push("/login/staff");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="hawk-header">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <HawkLogo size={28} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange">
              HawkChat staff
            </p>
            <h1 className="font-display text-lg font-bold uppercase tracking-wide text-hawk-50">
              {title ?? "Events"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!onPicker && (
            <Link href="/events" className="hawk-btn-secondary px-4 py-2 text-sm">
              All events
            </Link>
          )}
          {canManageEvents && !onManageEvents && (
            <Link
              href="/admin/events"
              className="hawk-btn-secondary px-4 py-2 text-sm"
            >
              Manage events
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>
      <div className="h-0.5 w-full bg-hawk-orange" />
    </header>
  );
}
