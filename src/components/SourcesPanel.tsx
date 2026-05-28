"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";

type SourceRow = {
  id: string;
  name: string;
  type: string;
  created_at: string;
  char_count: number;
};

export function SourcesPanel({ notebookId }: { notebookId: string }) {
  const { permissions } = useSession();
  const canUpload = permissions.canUpload;
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("Pasted notes");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/notebooks/${notebookId}/sources`);
    setSources(await res.json());
  }, [notebookId]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    await load();
  }

  async function uploadPaste() {
    if (!pasteText.trim()) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("text", pasteText);
    form.append("name", pasteName);
    const res = await fetch(`/api/notebooks/${notebookId}/sources`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setPasteText("");
    setPasteOpen(false);
    await load();
  }

  async function removeSource(sourceId: string) {
    if (!confirm("Remove this source from the notebook?")) return;
    const res = await fetch(
      `/api/notebooks/${notebookId}/sources/${sourceId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not remove source");
      return;
    }
    await load();
  }

  return (
    <div className="flex h-full flex-col border-r border-hawk-600 bg-hawk-950/80 backdrop-blur-md">
      <div className="border-b border-hawk-600 px-4 py-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-orange">
          Sources
        </h2>
        <p className="mt-1 text-xs text-hawk-300">
          {canUpload
            ? "PDF, TXT, MD — indexed for grounded chat"
            : "Shared sources — view & chat only"}
        </p>
      </div>

      {canUpload ? (
        <div className="space-y-2 border-b border-hawk-600 p-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange/40 bg-orange/5 px-4 py-6 text-center transition hover:border-orange hover:bg-orange/10">
            <span className="text-sm font-medium text-hawk-100">
              {uploading ? "Indexing…" : "Drop file or click to upload"}
            </span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,.htm"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setPasteOpen(!pasteOpen)}
            className="hawk-btn-secondary w-full py-2 text-sm"
          >
            {pasteOpen ? "Cancel paste" : "Paste text instead"}
          </button>
          {pasteOpen && (
            <div className="space-y-2">
              <input
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                className="hawk-input w-full px-3 py-2 text-sm"
                placeholder="Source name"
              />
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                className="hawk-input w-full px-3 py-2 text-sm"
                placeholder="Paste article, notes, or transcript…"
              />
              <button
                onClick={uploadPaste}
                disabled={uploading || !pasteText.trim()}
                className="hawk-btn-primary w-full py-2 text-sm disabled:opacity-50"
              >
                Add source
              </button>
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-orange/30 bg-orange/10 px-3 py-2 text-xs text-orange-light">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="border-b border-hawk-600 px-4 py-3">
          <p className="rounded-lg border border-hawk-600 bg-hawk-800/80 px-3 py-2 text-xs leading-relaxed text-hawk-300">
            View-only access. Ask questions in the chat — uploads are managed
            by your team.
          </p>
        </div>
      )}

      <ul className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {sources.length === 0 ? (
          <li className="px-2 py-8 text-center text-sm text-hawk-400">
            No sources yet
          </li>
        ) : (
          sources.map((s) => (
            <li
              key={s.id}
              className="group flex items-start justify-between gap-2 rounded-lg border border-hawk-600 bg-hawk-800/80 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-hawk-100">
                  {s.name}
                </p>
                <p className="text-xs text-hawk-400">
                  {(s.char_count / 1000).toFixed(1)}k chars
                </p>
              </div>
              {canUpload && (
                <button
                  onClick={() => removeSource(s.id)}
                  className="shrink-0 text-xs text-hawk-500 opacity-0 transition group-hover:opacity-100 hover:text-orange"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
