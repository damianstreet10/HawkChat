"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HawkLogo } from "./HawkLogo";
import { useSession } from "@/hooks/useSession";

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

function staffDisplayName(user: {
  name: string;
  email: string;
  role: string;
}): string {
  if (user.name && user.name !== "Admin" && user.name !== "Monitor") {
    return user.name;
  }
  const local = user.email.split("@")[0] ?? user.email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function AppHeader({
  children,
}: {
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const onAdminPage = pathname?.startsWith("/admin");
  const [signingOut, setSigningOut] = useState(false);
  const [siteGate, setSiteGate] = useState(false);
  const [lockingSite, setLockingSite] = useState(false);

  useEffect(() => {
    fetch("/api/auth/site-status")
      .then((r) => r.json())
      .then((d: { siteGate: boolean }) => setSiteGate(Boolean(d.siteGate)))
      .catch(() => setSiteGate(false));
  }, []);

  const isStaff =
    session.authenticated &&
    session.user &&
    (session.user.role === "admin" || session.user.role === "monitor");

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      session.refresh();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  async function lockSite() {
    setLockingSite(true);
    try {
      await fetch("/api/auth/site-logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLockingSite(false);
    }
  }

  return (
    <header className="hawk-header">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <HawkLogo size={28} />
            <div>
              <h1 className="font-display text-xl font-bold uppercase tracking-wide text-hawk-50">
                {LAN_DEMO ? "World Cup 2026" : "HawkChat"}
              </h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-hawk-300">
                {LAN_DEMO
                  ? "Hawk-Eye Innovations"
                  : "Powered by Hawk-Eye Innovations"}
              </p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isStaff && session.user && (
            <>
              <p className="hidden text-right sm:block">
                <span className="block text-xs font-semibold uppercase tracking-widest text-hawk-400">
                  Signed in
                </span>
                <span className="text-sm font-medium text-hawk-100">
                  {staffDisplayName(session.user)}
                </span>
                <span className="ml-1 text-xs capitalize text-orange">
                  {session.user.role}
                </span>
              </p>
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          )}
          {siteGate && (
            <button
              type="button"
              onClick={lockSite}
              disabled={lockingSite}
              className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
            >
              {lockingSite ? "Locking…" : "Lock site"}
            </button>
          )}
          {session.authenticated && session.permissions.canViewActivity && (
            <>
              {pathname !== "/admin/activity" && (
                <Link
                  href="/admin/activity"
                  className="hawk-btn-secondary px-4 py-2 text-sm"
                >
                  Activity
                </Link>
              )}
              {pathname !== "/admin/quirks" && (
                <Link
                  href="/admin/quirks"
                  className="hawk-btn-secondary px-4 py-2 text-sm"
                >
                  Kit quirks
                </Link>
              )}
            </>
          )}
          {onAdminPage && (
            <Link href="/" className="hawk-btn-secondary px-4 py-2 text-sm">
              Home
            </Link>
          )}
          {!onAdminPage && children}
        </div>
      </div>
      <div className="h-0.5 w-full bg-hawk-orange" />
    </header>
  );
}
