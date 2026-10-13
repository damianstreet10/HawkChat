"use client";

/**
 * Notebook chat / quirks workspace (`/notebook/[id]`).
 * Debug title edit, chat disabled by event dates, Sources vs Chat layout, or
 * kit-quirks swap — optional `?event=` scopes home link and chatOpen checks.
 */
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { KitQuirksPanel } from "@/components/KitQuirksPanel";
import { SourcesPanel } from "@/components/SourcesPanel";
import { HawkLogo } from "@/components/HawkLogo";
import { useSession } from "@/hooks/useSession";
import { isKitQuirksNotebook } from "@/lib/kit-quirks";
import { isStaffPortalRole } from "@/lib/permissions";

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

function NotebookPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const eventSlug = searchParams.get("event");
  const homeHref = eventSlug ? `/events/${eventSlug}` : "/";
  const homeLabel = eventSlug ? "← Project" : "← Home";
  const session = useSession();
  const { permissions } = session;
  const canManage = permissions.canManageNotebooks && !LAN_DEMO;
  const isQuirks = isKitQuirksNotebook(id);
  const [title, setTitle] = useState("Notebook");
  const [editing, setEditing] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatDisabledReason, setChatDisabledReason] = useState<string | null>(
    null,
  );

  useEffect(() => {
    fetch(`/api/notebooks/${id}`)
      .then((r) => r.json())
      .then((nb) => {
        if (nb.title) setTitle(nb.title);
        if (typeof nb.chatOpen === "boolean") {
          setChatOpen(nb.chatOpen);
          if (!nb.chatOpen && !eventSlug) {
            setChatDisabledReason(
              "This project is not active. You can browse notebooks but cannot ask new questions.",
            );
          }
        }
      });
  }, [id, eventSlug]);

  useEffect(() => {
    if (!eventSlug || session.loading) return;
    if (session.user && isStaffPortalRole(session.user.role)) {
      setChatOpen(true);
      setChatDisabledReason(null);
      return;
    }

    fetch(`/api/events/${eventSlug}`)
      .then((r) => r.json())
      .then((event) => {
        const open = event.chatOpen !== false;
        setChatOpen(open);
        if (open) {
          setChatDisabledReason(null);
          return;
        }
        if (event.timeStatus === "upcoming") {
          setChatDisabledReason(
            event.dateRangeLabel
              ? `This project opens ${event.dateRangeLabel}. You can browse notebooks until then.`
              : "This project has not started yet. You can browse notebooks until it opens.",
          );
        } else {
          setChatDisabledReason(
            event.dateRangeLabel
              ? `This project ended (${event.dateRangeLabel}). You can browse notebooks but cannot ask new questions.`
              : "This project has ended. You can browse notebooks but cannot ask new questions.",
          );
        }
      })
      .catch(() => {
        /* keep chatOpen from notebook fetch */
      });
  }, [eventSlug, session.loading, session.user]);

  async function saveTitle(next: string) {
    const trimmed = next.trim();
    if (!trimmed || !canManage) return;
    setTitle(trimmed);
    await fetch(`/api/notebooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
  }

  return (
    <div className="flex h-screen flex-col bg-hawk-hero">
      {/* --- Header (back link, logo, editable title) --- */}
      <header className="hawk-header flex shrink-0 items-center gap-4 px-4 py-3">
        <Link
          href={homeHref}
          className="text-sm text-hawk-300 transition hover:text-orange"
        >
          {homeLabel}
        </Link>
        <HawkLogo size={24} />
        {canManage && editing ? (
          <input
            autoFocus
            defaultValue={title}
            className="font-display flex-1 border-b border-orange bg-transparent text-lg font-bold uppercase tracking-wide text-hawk-50 outline-none"
            onBlur={(e) => {
              setEditing(false);
              saveTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
                saveTitle((e.target as HTMLInputElement).value);
              }
            }}
          />
        ) : (
          <h1 className="font-display flex-1 text-lg font-bold uppercase tracking-wide text-hawk-50">
            {title}
          </h1>
        )}
      </header>
      <div className="h-0.5 w-full bg-hawk-orange" />

      {/* --- Main: sources sidebar + chat (or kit quirks form) --- */}
      <div
        className={
          LAN_DEMO
            ? "min-h-0 flex-1"
            : "grid min-h-0 flex-1 grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
        }
      >
        {!LAN_DEMO && !isQuirks && <SourcesPanel notebookId={id} />}
        {isQuirks ? (
          <KitQuirksPanel eventSlug={eventSlug ?? undefined} />
        ) : (
          <ChatPanel
            notebookId={id}
            chatDisabled={!chatOpen}
            chatDisabledReason={chatDisabledReason}
          />
        )}
      </div>
    </div>
  );
}

export default function NotebookPage() {
  return (
    <Suspense>
      <NotebookPageContent />
    </Suspense>
  );
}
