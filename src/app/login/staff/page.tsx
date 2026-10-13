"use client";

/**
 * Staff/member email + password sign-in.
 * Debug failed login, legacy accounts without passwords (use Create account),
 * or post-login redirect via `?from=`.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HawkLogo } from "@/components/HawkLogo";

function PasswordLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/events";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
              HawkChat
            </h1>
            <p className="text-xs text-hawk-300">
              Sign in with your email and password to open the projects you are
              enrolled in
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
              autoComplete="email"
              autoFocus
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="Your password"
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

        <p className="mt-6 text-center text-sm text-hawk-300">
          New here?{" "}
          <Link
            href={`/login/register${from !== "/events" ? `?from=${encodeURIComponent(from)}` : ""}`}
            className="font-medium text-orange-light underline-offset-2 hover:underline"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-hawk-400">
          After you create an account, an admin can enroll you in projects.
        </p>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense>
      <PasswordLoginForm />
    </Suspense>
  );
}
