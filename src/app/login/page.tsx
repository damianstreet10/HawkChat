"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HawkLogo } from "@/components/HawkLogo";
import { useSession } from "@/hooks/useSession";

function SiteLoginForm() {
  const router = useRouter();
  const session = useSession();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
  const [siteGate, setSiteGate] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/site-status")
      .then((r) => r.json())
      .then((d: { siteGate: boolean }) => {
        setSiteGate(d.siteGate);
        if (!d.siteGate) router.replace("/login/staff");
      })
      .catch(() => setSiteGate(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/site-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, displayName }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Incorrect password");
      return;
    }

    session.refresh();
    router.push(from);
    router.refresh();
  }

  if (siteGate === null) {
    return (
      <div className="hawk-page flex min-h-screen items-center justify-center">
        <p className="text-hawk-400">Loading…</p>
      </div>
    );
  }

  if (!siteGate) return null;

  return (
    <div className="hawk-page flex min-h-screen items-center justify-center px-4">
      <div className="hawk-card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <HawkLogo size={32} />
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-hawk-50">
              HawkChat
            </h1>
            <p className="text-xs font-semibold uppercase tracking-widest text-hawk-300">
              Hawk-Eye Innovations
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-hawk-200">
          Login to ask about important documents, software and{" "}
          <span
            className="cursor-not-allowed text-hawk-500"
            title="Not available yet"
          >
            hardware troubleshooting
          </span>
          , and submit kit quirks.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Your name <span className="text-orange">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="Required — shown to admins in Activity"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Site password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="hawk-input w-full px-3 py-2.5 text-sm"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-orange/30 bg-orange/10 px-3 py-2 text-sm text-orange-light">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="hawk-btn-primary w-full py-3 text-sm disabled:opacity-60"
          >
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-hawk-400">
          Staff:{" "}
          <Link href="/login/staff" className="text-orange hover:underline">
            Admin sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <SiteLoginForm />
    </Suspense>
  );
}
