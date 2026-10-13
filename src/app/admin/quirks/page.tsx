"use client";

/**
 * Global kit-quirks admin shell (Suspense wrapper).
 * Debug loading fallback only — real filters/stats UI is in `AdminQuirksPanel`.
 */
import { Suspense } from "react";
import { AdminQuirksPanel } from "@/components/AdminQuirksPanel";

export default function AdminQuirksPage() {
  return (
    <Suspense
      fallback={
        <div className="hawk-page min-h-screen p-10 text-hawk-400">Loading…</div>
      }
    >
      <AdminQuirksPanel />
    </Suspense>
  );
}
