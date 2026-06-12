"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HawkLogo } from "@/components/HawkLogo";

function StaffLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/events";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Sign in failed");
      return;
    }

    router.push(data.redirectTo ?? from);
    router.refresh();
  }

  return (
    <div className="hawk-page flex min-h-screen items-center justify-center px-4">
      <div className="hawk-card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <HawkLogo size={32} />
          <div>
            <h1 className="font-display text-xl font-bold uppercase tracking-wide text-hawk-50">
              Staff sign in
            </h1>
            <p className="text-xs text-hawk-300">
              Admin / monitor — use your <strong className="text-hawk-200">access token</strong>
              , not the shared site password
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="hawk-input w-full px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Access token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-hawk-400">
          <Link href="/login" className="text-orange hover:underline">
            Back to site password
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense>
      <StaffLoginForm />
    </Suspense>
  );
}
