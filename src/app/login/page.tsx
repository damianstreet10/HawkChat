"use client";

/**
 * Legacy `/login` — redirects to password staff login.
 * Debug redirect loops or lost `?from=`; real sign-in UI is `login/staff`,
 * account creation is `login/register`.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Site password login retired — email + password sign-in is at /login/staff. */
function RedirectToEmailLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const from = searchParams.get("from");
    const q = from ? `?from=${encodeURIComponent(from)}` : "";
    router.replace(`/login/staff${q}`);
  }, [router, searchParams]);

  return (
    <div className="hawk-page flex min-h-screen items-center justify-center">
      <p className="text-hawk-400">Redirecting…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <RedirectToEmailLogin />
    </Suspense>
  );
}
