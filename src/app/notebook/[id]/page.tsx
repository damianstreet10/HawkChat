"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { KitQuirksPanel } from "@/components/KitQuirksPanel";
import { SourcesPanel } from "@/components/SourcesPanel";
import { HawkLogo } from "@/components/HawkLogo";
import { useSession } from "@/hooks/useSession";
import { isKitQuirksNotebook } from "@/lib/kit-quirks";

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

export default function NotebookPage() {
  const params = useParams();
  const id = params.id as string;
  const { permissions } = useSession();
  const canManage = permissions.canManageNotebooks && !LAN_DEMO;
  const isQuirks = isKitQuirksNotebook(id);
  const [title, setTitle] = useState("Notebook");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/notebooks/${id}`)
      .then((r) => r.json())
      .then((nb) => {
        if (nb.title) setTitle(nb.title);
      });
  }, [id]);

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
      <header className="hawk-header flex shrink-0 items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm text-hawk-300 transition hover:text-orange"
        >
          ← Home
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

      <div
        className={
          LAN_DEMO
            ? "min-h-0 flex-1"
            : "grid min-h-0 flex-1 grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]"
        }
      >
        {!LAN_DEMO && !isQuirks && <SourcesPanel notebookId={id} />}
        {isQuirks ? <KitQuirksPanel /> : <ChatPanel notebookId={id} />}
      </div>
    </div>
  );
}
