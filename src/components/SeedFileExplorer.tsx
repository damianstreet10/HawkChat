"use client";

/**
 * List/upload/delete seed files for a notebook or template folder.
 * Debug file explorer API base path, upload accept types, or refresh after change.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type SeedFileExplorerProps = {
  apiBase: string;
  title?: string;
  seedPath?: string;
  compact?: boolean;
  onFilesChanged?: () => void;
};

export function SeedFileExplorer({
  apiBase,
  title,
  seedPath,
  compact = false,
  onFilesChanged,
}: SeedFileExplorerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load files.");
      }
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load files.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(fileList)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(apiBase, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? `Could not upload ${file.name}.`);
        }
        setFiles(data.files ?? []);
      }
      onFilesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile(name: string) {
    if (!confirm(`Remove "${name}" from this folder?`)) return;

    setRemoving(name);
    setError(null);

    try {
      const res = await fetch(
        `${apiBase}?name=${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not delete file.");
      }
      setFiles(data.files ?? []);
      onFilesChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div
      className={
        compact
          ? "rounded-md border border-hawk-600 bg-hawk-950/60 p-3"
          : "rounded-lg border border-hawk-600 bg-hawk-900/40 p-4"
      }
    >
      {(title || seedPath) && (
        <div className="mb-3">
          {title && (
            <p className="text-sm font-semibold text-hawk-50">{title}</p>
          )}
          {seedPath && (
            <p className="mt-0.5 font-mono text-xs text-hawk-500">{seedPath}</p>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="hawk-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Add files"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading || uploading}
          className="hawk-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
        >
          Refresh
        </button>
        <span className="text-xs text-hawk-400">PDF, TXT, or Markdown</span>
      </div>

      {error && (
        <p className="mb-3 text-xs text-orange-light">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-hawk-400">Loading files…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-hawk-400">
          No documents yet. Use Add files to upload into this notebook folder.
        </p>
      ) : (
        <ul className={`space-y-1 ${compact ? "max-h-36" : "max-h-52"} overflow-y-auto`}>
          {files.map((file) => (
            <li
              key={file}
              className="flex items-center justify-between gap-2 rounded-md border border-hawk-700/80 bg-hawk-950/50 px-2 py-1.5"
            >
              <span
                className="min-w-0 flex-1 truncate font-mono text-xs text-hawk-100"
                title={file}
              >
                {file}
              </span>
              <button
                type="button"
                onClick={() => removeFile(file)}
                disabled={removing === file || uploading}
                className="shrink-0 text-xs text-orange-light hover:underline disabled:opacity-50"
              >
                {removing === file ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
