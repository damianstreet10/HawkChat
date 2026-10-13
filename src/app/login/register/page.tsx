"use client";

/**
 * Self-serve account creation (email + password).
 * Also claims legacy passwordless accounts by setting a password for that email.
 * After signup, users wait for an admin to enroll them in projects.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HawkLogo } from "@/components/HawkLogo";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/events";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email,
        password,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Could not create account.");
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
              Create account
            </h1>
            <p className="text-xs text-hawk-300">
              Choose an email and password. An admin will assign you to projects
              afterward.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Name <span className="text-hawk-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="Your name"
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-hawk-200">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="hawk-input w-full px-3 py-2.5 text-sm"
              placeholder="Repeat password"
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
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-hawk-300">
          Already have an account?{" "}
          <Link
            href={`/login/staff${from !== "/events" ? `?from=${encodeURIComponent(from)}` : ""}`}
            className="font-medium text-orange-light underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
