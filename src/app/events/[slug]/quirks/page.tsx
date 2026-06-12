"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminQuirksPanel } from "@/components/AdminQuirksPanel";

function EventQuirksInner() {
  const params = useParams();
  const slug = params.slug as string;
  const [title, setTitle] = useState<string | undefined>();

  useEffect(() => {
    fetch(`/api/events/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.title) setTitle(d.title);
      })
      .catch(() => {});
  }, [slug]);

  return <AdminQuirksPanel eventSlug={slug} eventTitle={title} />;
}

export default function EventQuirksPage() {
  return (
    <Suspense
      fallback={
        <div className="hawk-page min-h-screen p-10 text-hawk-400">Loading…</div>
      }
    >
      <EventQuirksInner />
    </Suspense>
  );
}
