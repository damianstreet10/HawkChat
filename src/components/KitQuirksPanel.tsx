"use client";

import { useEffect, useState } from "react";

export function KitQuirksPanel() {
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [kitName, setKitName] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [quirkDetails, setQuirkDetails] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client/session")
      .then((r) => r.json())
      .then((data: { guestLabel?: string | null }) => {
        if (data.guestLabel) setReporterName(data.guestLabel);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/kit-quirks/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName,
          reporterEmail,
          kitName,
          assetTag,
          quirkDetails,
          extraNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save report");

      setSuccess(data.message ?? "Report saved.");
      setReporterEmail("");
      setKitName("");
      setAssetTag("");
      setQuirkDetails("");
      setExtraNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save report");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-hawk-900/50">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-xl">
          <span className="hawk-badge mb-4">KIT QUIRKS</span>
          <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
            Report a kit or PC quirk
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-hawk-300">
            List what kit or PC you are using and describe the issue. We auto-route
            reports to the right team (Network, Hardware, PC, Camera). Add your
            email so we can notify you when the issue is resolved.
          </p>

          <form onSubmit={handleSubmit} className="hawk-card space-y-4 p-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                Your email <span className="text-orange">*</span>
              </label>
              <input
                type="email"
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                required
                autoComplete="email"
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                Your name
              </label>
              <input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="So admins know who reported this"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                Kit / equipment <span className="text-orange">*</span>
              </label>
              <input
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                required
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="e.g. Broadcast PC, camera rig, laptop model"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                Asset tag / PC name
              </label>
              <input
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="e.g. IT-042, MCR-3"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                What is the quirk? <span className="text-orange">*</span>
              </label>
              <textarea
                value={quirkDetails}
                onChange={(e) => setQuirkDetails(e.target.value)}
                required
                rows={5}
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="Describe the problem, when it happens, error messages…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-hawk-200">
                Extra notes
              </label>
              <textarea
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                rows={3}
                className="hawk-input w-full px-3 py-2.5 text-sm"
                placeholder="Workarounds tried, urgency, contact details…"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-orange/30 bg-orange/10 px-3 py-2 text-sm text-orange-light">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg border border-hawk-500 bg-hawk-800/80 px-3 py-2 text-sm text-hawk-100">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              className="hawk-btn-primary w-full py-3 text-sm disabled:opacity-60"
            >
              {sending ? "Saving…" : "Submit report"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
