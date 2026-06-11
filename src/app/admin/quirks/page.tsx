"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  QuirkCategoryOverview,
  type QuirkStatsPayload,
} from "@/components/QuirkCategoryOverview";
import { useSession } from "@/hooks/useSession";
import {
  QUIRK_CATEGORIES,
  QUIRK_CATEGORY_FILTERS,
  QUIRK_CATEGORY_LABELS,
  type QuirkCategory,
  type QuirkCategoryFilter,
  isQuirkCategoryFilter,
} from "@/lib/quirk-category";
import {
  QUIRK_FILTER_TABS,
  QUIRK_STATUS_LABELS,
  type QuirkStatus,
  type QuirkStatusFilter,
} from "@/lib/quirk-status";

type QuirkReport = {
  id: string;
  reference_id: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  kit_name: string;
  asset_tag: string | null;
  quirk_details: string;
  extra_notes: string | null;
  resolution_notes: string | null;
  category: QuirkCategory | null;
  category_source: string | null;
  client_ip: string | null;
  guest_label: string | null;
  created_at: string;
  status: QuirkStatus;
  resolved_at: string | null;
  resolved_by: string | null;
};

const STATUS_BADGE: Record<QuirkStatus, string> = {
  new: "border-orange/50 bg-orange/15 text-orange-light",
  in_progress: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
};

const CATEGORY_BADGE: Record<QuirkCategory, string> = {
  network: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  hardware: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  pc: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
  camera: "border-teal-500/40 bg-teal-500/10 text-teal-200",
  other: "border-hawk-500 bg-hawk-800/80 text-hawk-200",
};

function buildQuery(
  status: QuirkStatusFilter,
  category: QuirkCategoryFilter,
  q: string,
): string {
  const params = new URLSearchParams({ status, category });
  if (q.trim()) params.set("q", q.trim());
  return params.toString();
}

type AdminView = "overview" | "reports";

const VIEW_TABS: Array<{ id: AdminView; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
];

export default function AdminQuirksPage() {
  return (
    <Suspense fallback={<div className="hawk-page min-h-screen p-10 text-hawk-400">Loading…</div>}>
      <AdminQuirksContent />
    </Suspense>
  );
}

function AdminQuirksContent() {
  const session = useSession();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [view, setView] = useState<AdminView>("overview");
  const [stats, setStats] = useState<QuirkStatsPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuirkStatusFilter>("new");
  const [categoryFilter, setCategoryFilter] = useState<QuirkCategoryFilter>(
    () =>
      initialCategory && isQuirkCategoryFilter(initialCategory)
        ? initialCategory
        : "all",
  );
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [reports, setReports] = useState<QuirkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const [notifyConfigured, setNotifyConfigured] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingResolve, setPendingResolve] = useState<{
    id: string;
    notes: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  const canAccess =
    session.authenticated && session.permissions.canViewActivity;

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const query = buildQuery(statusFilter, categoryFilter, searchDebounced);
    const res = await fetch(`/api/admin/quirks?${query}`);
    if (res.status === 401 || res.status === 403) {
      setError("Sign in with an admin or monitor account.");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load reports.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setReports(
      (data.reports ?? []).map((r: QuirkReport & { status?: string }) => ({
        ...r,
        status: (r.status as QuirkStatus) || "new",
        category: r.category ?? "other",
      })),
    );
    setSmtpConfigured(data.smtpConfigured !== false);
    setNotifyConfigured(data.notifyConfigured === true);
    setError(null);
    setLoading(false);
  }, [statusFilter, categoryFilter, searchDebounced]);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/quirks/stats");
    if (res.status === 401 || res.status === 403) {
      setError("Sign in with an admin or monitor account.");
      setStatsLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Could not load overview.");
      setStatsLoading(false);
      return;
    }
    setStats(await res.json());
    setError(null);
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Sign in with an admin or monitor account.");
      setLoading(false);
      setStatsLoading(false);
      return;
    }
    if (view === "overview") {
      setStatsLoading(true);
      loadStats();
    } else {
      setLoading(true);
      load();
    }
  }, [session.loading, canAccess, view, load, loadStats]);

  useEffect(() => {
    if (session.loading || !canAccess) return;
    const id = setInterval(() => {
      if (view === "overview") loadStats();
      else load();
    }, 15000);
    return () => clearInterval(id);
  }, [session.loading, canAccess, view, load, loadStats]);

  async function patchReport(
    reportId: string,
    body: {
      status?: QuirkStatus;
      category?: QuirkCategory | "";
      resolutionNotes?: string;
    },
  ) {
    setUpdatingId(reportId);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/quirks/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update report");
      }
      if (typeof data.emailNotice === "string") {
        setNotice(data.emailNotice);
      }
      await load();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update report");
    } finally {
      setUpdatingId(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const query = buildQuery(statusFilter, categoryFilter, searchDebounced);
      const res = await fetch(`/api/admin/quirks/export?${query}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `kit-quirks-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export CSV.");
    } finally {
      setExporting(false);
    }
  }

  function handleStatusChange(report: QuirkReport, next: QuirkStatus) {
    if (next === "resolved" && report.status !== "resolved") {
      setPendingResolve({ id: report.id, notes: report.resolution_notes ?? "" });
      return;
    }
    setPendingResolve(null);
    patchReport(report.id, { status: next });
  }

  return (
    <div className="hawk-page min-h-screen">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
              Kit Quirks reports
            </h2>
            <p className="max-w-2xl text-sm text-hawk-300">
              Reports are auto-tagged by problem type from the description. Staff
              can filter to their area (e.g.{" "}
              <Link
                href="/admin/quirks?category=network"
                className="text-orange-light hover:underline"
              >
                Network
              </Link>
              ) and override tags if needed. Refreshes every 15 seconds.
            </p>
          </div>
          {canAccess && !error && view === "reports" && (
            <button
              type="button"
              onClick={exportCsv}
              disabled={exporting}
              className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
        </div>

        {canAccess && !error && (
          <div
            className="mb-6 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Quirks section"
          >
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={view === tab.id}
                onClick={() => setView(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === tab.id ? "hawk-btn-primary" : "hawk-btn-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {view === "reports" && (
          <>
            {!smtpConfigured && (
              <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                SMTP is not configured — resolution emails need HAWKCHAT_SMTP_*
                in .env.
              </p>
            )}
            {!notifyConfigured && (
              <p className="mb-4 rounded-lg border border-hawk-600 bg-hawk-800/50 px-4 py-3 text-sm text-hawk-300">
                New-quirk alerts are off — set HAWKCHAT_QUIRK_WEBHOOK_URL and/or
                HAWKCHAT_QUIRK_NOTIFY_EMAIL in .env when ready.
              </p>
            )}
            {notice && (
              <p className="mb-4 rounded-lg border border-hawk-500 bg-hawk-800/80 px-4 py-3 text-sm text-hawk-100">
                {notice}
              </p>
            )}
          </>
        )}

        {categoryFilter !== "all" && view === "reports" && (
          <p className="mb-4 text-sm text-hawk-300">
            Showing{" "}
            <span className="font-semibold text-hawk-100">
              {categoryFilter === "uncategorized"
                ? "uncategorized"
                : QUIRK_CATEGORY_LABELS[categoryFilter as QuirkCategory]}
            </span>{" "}
            issues only.{" "}
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setLoading(true);
              }}
              className="text-orange-light hover:underline"
            >
              Show all types
            </button>
          </p>
        )}

        {canAccess && !error && view === "reports" && (
          <>
            <div
              className="mb-4 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filter by status"
            >
              {QUIRK_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setLoading(true);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    statusFilter === tab.id
                      ? "hawk-btn-primary"
                      : "hawk-btn-secondary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLoading(true);
                }}
                placeholder="Search kit, asset tag, email, reference, details…"
                className="hawk-input flex-1 px-3 py-2 text-sm"
              />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as QuirkCategoryFilter);
                  setLoading(true);
                }}
                className="hawk-input px-3 py-2 text-sm sm:min-w-[11rem]"
                aria-label="Filter by problem type"
              >
                {QUIRK_CATEGORY_FILTERS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {session.loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link
              href="/login/staff?from=/admin/quirks"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : view === "overview" ? (
          <QuirkCategoryOverview stats={stats} loading={statsLoading} />
        ) : loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="text-hawk-400">No reports match these filters.</p>
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => (
              <li
                key={r.id}
                className={`hawk-card p-5 ${r.status === "resolved" ? "opacity-90" : ""}`}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {r.reference_id && (
                      <span className="font-mono text-xs font-bold text-orange-light">
                        {r.reference_id}
                      </span>
                    )}
                    <p className="font-display text-lg font-bold text-hawk-50">
                      {r.kit_name}
                      {r.asset_tag && (
                        <span className="ml-2 font-mono text-sm font-normal text-orange-light">
                          {r.asset_tag}
                        </span>
                      )}
                    </p>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE[r.status]}`}
                    >
                      {QUIRK_STATUS_LABELS[r.status]}
                    </span>
                    {r.category && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${CATEGORY_BADGE[r.category]}`}
                      >
                        {QUIRK_CATEGORY_LABELS[r.category]}
                        {r.category_source === "auto" && (
                          <span className="ml-1 normal-case tracking-normal opacity-80">
                            · auto
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`category-${r.id}`}>
                      Problem type for {r.kit_name}
                    </label>
                    <select
                      id={`category-${r.id}`}
                      value={r.category ?? ""}
                      disabled={updatingId === r.id}
                      onChange={(e) =>
                        patchReport(r.id, {
                          category: e.target.value as QuirkCategory | "",
                        })
                      }
                      className="hawk-input px-3 py-1.5 text-sm"
                      title="Override auto-detected type"
                    >
                      <option value="">Retag…</option>
                      {QUIRK_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {QUIRK_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor={`status-${r.id}`}>
                      Status for {r.kit_name}
                    </label>
                    <select
                      id={`status-${r.id}`}
                      value={r.status}
                      disabled={updatingId === r.id}
                      onChange={(e) =>
                        handleStatusChange(r, e.target.value as QuirkStatus)
                      }
                      className="hawk-input px-3 py-1.5 text-sm"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <time className="text-xs text-hawk-400">
                      {new Date(r.created_at).toLocaleString()}
                    </time>
                  </div>
                </div>

                {pendingResolve?.id === r.id && (
                  <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <label
                      htmlFor={`resolve-notes-${r.id}`}
                      className="mb-2 block text-sm font-medium text-hawk-100"
                    >
                      Resolution notes (included in email to reporter)
                    </label>
                    <textarea
                      id={`resolve-notes-${r.id}`}
                      value={pendingResolve.notes}
                      onChange={(e) =>
                        setPendingResolve({
                          id: r.id,
                          notes: e.target.value,
                        })
                      }
                      rows={3}
                      className="hawk-input mb-3 w-full px-3 py-2 text-sm"
                      placeholder="What was fixed, e.g. replaced network cable, reinstalled driver…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() => {
                          patchReport(r.id, {
                            status: "resolved",
                            resolutionNotes: pendingResolve.notes,
                          });
                          setPendingResolve(null);
                        }}
                        className="hawk-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                      >
                        Confirm resolved & email
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingResolve(null)}
                        className="hawk-btn-secondary px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <p className="mb-2 text-sm text-hawk-300">
                  <span className="text-hawk-500">From:</span>{" "}
                  {r.reporter_name || r.guest_label || "—"}
                  {r.reporter_email ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={`mailto:${r.reporter_email}`}
                        className="text-orange-light hover:underline"
                      >
                        {r.reporter_email}
                      </a>
                    </>
                  ) : (
                    <span className="ml-1 text-hawk-500">(no email)</span>
                  )}
                  {r.client_ip && (
                    <span className="ml-2 font-mono text-xs text-hawk-500">
                      {r.client_ip}
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-hawk-100">
                  {r.quirk_details}
                </p>
                {r.extra_notes && (
                  <p className="mt-3 whitespace-pre-wrap border-t border-hawk-600 pt-3 text-sm text-hawk-300">
                    <span className="font-medium text-hawk-400">Notes: </span>
                    {r.extra_notes}
                  </p>
                )}
                {r.resolution_notes && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100">
                    <span className="font-medium text-emerald-200/80">
                      Resolution:{" "}
                    </span>
                    {r.resolution_notes}
                    {r.resolved_by && (
                      <span className="mt-1 block text-xs text-hawk-400">
                        by {r.resolved_by}
                        {r.resolved_at &&
                          ` · ${new Date(r.resolved_at).toLocaleString()}`}
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
