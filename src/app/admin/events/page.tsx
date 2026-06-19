"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { SeedFileExplorer } from "@/components/SeedFileExplorer";
import { useSession } from "@/hooks/useSession";
import { WORLD_CUP_EVENT_SLUG } from "@/lib/world-cup-constants";
import {
  NOTEBOOK_TEMPLATE_IDS,
  notebookTemplateHasSeedFiles,
  type NotebookTemplateId,
} from "@/lib/notebook-templates";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  notebookCount?: number;
};

type NotebookTemplate = {
  id: NotebookTemplateId;
  title: string;
  pickerLabel: string;
  description: string;
  sourceDir: string;
  files: string[];
  fileCount: number;
};

type EventNotebookFiles = {
  notebookId: string;
  notebookTitle: string;
  seedPath: string;
  pickerLabel: string | null;
  files: string[];
};

export default function AdminEventsPage() {
  const session = useSession();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmails, setMemberEmails] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EventRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NotebookTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplates, setSelectedTemplates] = useState<
    Set<NotebookTemplateId>
  >(() => new Set(NOTEBOOK_TEMPLATE_IDS));
  const [expandedTemplate, setExpandedTemplate] =
    useState<NotebookTemplateId | null>(null);
  const [fileManagerEvent, setFileManagerEvent] = useState<EventRow | null>(
    null,
  );
  const [fileManagerNotebooks, setFileManagerNotebooks] = useState<
    EventNotebookFiles[]
  >([]);
  const [fileManagerLoading, setFileManagerLoading] = useState(false);
  const [fileManagerError, setFileManagerError] = useState<string | null>(
    null,
  );

  const canAccess =
    session.authenticated && session.user?.role === "admin";

  const load = useCallback(async () => {
    const res = await fetch("/api/events");
    if (!res.ok) {
      setError("Could not load events.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setEvents(data.events ?? []);
    setError(null);
    setLoading(false);
  }, []);

  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    const res = await fetch("/api/admin/events/notebook-templates");
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
    setTemplatesLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Admin sign in required.");
      setLoading(false);
      return;
    }
    load();
    loadTemplates();
  }, [session.loading, canAccess, load, loadTemplates]);

  function toggleTemplate(id: NotebookTemplateId) {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openFileManager(event: EventRow) {
    setFileManagerEvent(event);
    setFileManagerNotebooks([]);
    setFileManagerError(null);
    setFileManagerLoading(true);

    const res = await fetch(`/api/admin/events/${event.slug}/seed-files`);
    const data = await res.json().catch(() => ({}));
    setFileManagerLoading(false);

    if (!res.ok) {
      setFileManagerError(data.error ?? "Could not load event files.");
      return;
    }

    setFileManagerNotebooks(data.notebooks ?? []);
  }

  function closeFileManager() {
    setFileManagerEvent(null);
    setFileManagerNotebooks([]);
    setFileManagerError(null);
    load();
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMessage(null);

    if (selectedTemplates.size === 0) {
      setCreateMessage("Select at least one notebook.");
      return;
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        description,
        memberEmails: memberEmails
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        notebookTemplates: [...selectedTemplates],
      }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      setCreateMessage(data.error ?? "Could not create event.");
      return;
    }

    setCreateMessage(
      `Created "${data.title}" with ${(data.notebooks ?? []).join(", ") || "no notebooks"}.` +
        (data.copiedFiles
          ? ` Copied ${data.copiedFiles} document(s) from seed/.`
          : "") +
        ` Members added: ${(data.membersAdded ?? []).join(", ") || "none"}.` +
        (data.membersMissing?.length
          ? ` Missing users: ${data.membersMissing.join(", ")} — create them first via Users API or HAWKCHAT_EVENT_USERS.`
          : "") +
        ` ${data.setupHint ?? ""}`,
    );
    setSlug("");
    setTitle("");
    setDescription("");
    setMemberEmails("");
    setSelectedTemplates(new Set(NOTEBOOK_TEMPLATE_IDS));
    load();
  }

  function openDeleteDialog(event: EventRow) {
    setPendingDelete(event);
    setDeleteConfirm("");
    setDeleteError(null);
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteConfirm("");
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteConfirm !== "Delete") return;

    setDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/events/${pendingDelete.slug}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);

    if (!res.ok) {
      setDeleteError(data.error ?? "Could not delete event.");
      return;
    }

    closeDeleteDialog();
    load();
  }

  return (
    <div className="hawk-page min-h-screen">
      <StaffPortalHeader title="Manage events" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          Manage events
        </h2>
        <p className="mb-8 text-sm text-hawk-300">
          Create tournament spaces with their own notebooks. Event members sign in
          at Staff sign in and land directly in their event — the World Cup LAN
          demo at <span className="text-hawk-100">/</span> is unchanged.
        </p>

        {session.loading || loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link
              href="/login/staff?from=/admin/events"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={createEvent} className="hawk-card mb-10 space-y-4 p-6">
              <h3 className="font-display text-lg font-bold text-hawk-50">
                Create event
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">Slug</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    required
                    placeholder="champions-league"
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="UEFA Champions League 2026"
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              <fieldset className="space-y-3">
                <legend className="mb-1 block text-sm font-medium text-hawk-200">
                  Notebooks
                </legend>
                <p className="text-xs text-hawk-400">
                  Choose notebooks for this event. Expand a folder to add or
                  remove files in the shared library — they are copied when the
                  event is created.
                </p>
                {templatesLoading ? (
                  <p className="text-sm text-hawk-400">Loading templates…</p>
                ) : (
                  <ul className="space-y-2">
                    {templates.map((template) => {
                      const selected = selectedTemplates.has(template.id);
                      const expanded = expandedTemplate === template.id;
                      return (
                        <li
                          key={template.id}
                          className={`rounded-lg border p-3 ${
                            selected
                              ? "border-orange/40 bg-orange/5"
                              : "border-hawk-600 bg-hawk-900/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleTemplate(template.id)}
                                className="mt-1"
                              />
                              <span>
                                <span className="block text-sm font-semibold text-hawk-50">
                                  {template.pickerLabel}
                                </span>
                                <span className="mt-0.5 block text-xs text-hawk-400">
                                  {template.description}
                                </span>
                                <span className="mt-1 block font-mono text-xs text-hawk-500">
                                  {notebookTemplateHasSeedFiles(template.id) ? (
                                    <>
                                      {template.sourceDir}
                                      {template.fileCount === 0
                                        ? " — no PDFs yet"
                                        : ` — ${template.fileCount} file(s)`}
                                    </>
                                  ) : (
                                    "Quirk reporting only — no documents"
                                  )}
                                </span>
                              </span>
                            </label>
                            {notebookTemplateHasSeedFiles(template.id) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedTemplate(
                                    expanded ? null : template.id,
                                  )
                                }
                                className="hawk-btn-secondary px-3 py-1.5 text-xs"
                              >
                                {expanded ? "Hide explorer" : "Manage files"}
                              </button>
                            ) : null}
                          </div>
                          {expanded && notebookTemplateHasSeedFiles(template.id) && (
                            <div className="mt-3">
                              <SeedFileExplorer
                                apiBase={`/api/admin/events/notebook-templates/${template.id}/files`}
                                seedPath={template.sourceDir}
                                compact
                                onFilesChanged={loadTemplates}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Member emails (comma or newline)
                </label>
                <textarea
                  value={memberEmails}
                  onChange={(e) => setMemberEmails(e.target.value)}
                  rows={2}
                  placeholder="test@hawkeyeinnovations.com"
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              {createMessage && (
                <p className="text-sm text-hawk-200">{createMessage}</p>
              )}
              <button
                type="submit"
                disabled={creating || selectedTemplates.size === 0}
                className="hawk-btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create event"}
              </button>
            </form>

            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-orange">
              Existing events
            </h3>
            {events.length === 0 ? (
              <p className="text-hawk-400">No events yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="hawk-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-display text-lg font-bold text-hawk-50">
                          {event.title}
                        </h4>
                        <p className="mt-1 font-mono text-xs text-hawk-400">
                          /events/{event.slug}
                        </p>
                        {event.description && (
                          <p className="mt-2 text-sm text-hawk-300">
                            {event.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-hawk-400">
                          {event.notebookCount ?? 0} notebook(s) in manifest
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/events/${event.slug}`}
                          className="hawk-btn-secondary px-4 py-2 text-sm"
                        >
                          Open space
                        </Link>
                        {event.slug !== WORLD_CUP_EVENT_SLUG && (
                          <>
                            <button
                              type="button"
                              onClick={() => openFileManager(event)}
                              className="hawk-btn-secondary px-4 py-2 text-sm"
                            >
                              Manage files
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteDialog(event)}
                              className="rounded-lg border border-orange/40 bg-orange/10 px-4 py-2 text-sm font-medium text-orange-light transition hover:border-orange/60 hover:bg-orange/15"
                            >
                              Delete event
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hawk-950/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
        >
          <div className="hawk-card w-full max-w-md p-6">
            <h3
              id="delete-event-title"
              className="font-display text-lg font-bold text-hawk-50"
            >
              Delete event?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-hawk-300">
              This removes{" "}
              <span className="font-semibold text-hawk-100">
                {pendingDelete.title}
              </span>{" "}
              (<span className="font-mono text-hawk-200">{pendingDelete.slug}</span>
              ) from the staff portal. Member access and kit quirk reports for this
              event are removed. Seed files under{" "}
              <span className="font-mono text-hawk-200">
                seed/events/{pendingDelete.slug}/
              </span>{" "}
              are not deleted and the event may reappear after a restart if still
              present on disk.
            </p>
            <label className="mt-5 block text-sm text-hawk-200">
              Type <span className="font-mono text-orange-light">Delete</span> to
              confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoComplete="off"
              autoFocus
              className="hawk-input mt-2 w-full px-3 py-2 text-sm"
              placeholder="Delete"
            />
            {deleteError && (
              <p className="mt-3 text-sm text-orange-light">{deleteError}</p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting || deleteConfirm !== "Delete"}
                className="rounded-lg border border-orange/50 bg-orange/20 px-4 py-2 text-sm font-medium text-orange-light transition hover:bg-orange/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fileManagerEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hawk-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-manager-title"
        >
          <div className="hawk-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
            <div className="border-b border-hawk-700 px-6 py-4">
              <h3
                id="file-manager-title"
                className="font-display text-lg font-bold text-hawk-50"
              >
                Event files — {fileManagerEvent.title}
              </h3>
              <p className="mt-1 text-sm text-hawk-300">
                Add or remove documents in each notebook folder. Uploads are
                saved to seed and indexed for chat immediately.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {fileManagerLoading ? (
                <p className="text-hawk-400">Loading notebooks…</p>
              ) : fileManagerError ? (
                <p className="text-orange-light">{fileManagerError}</p>
              ) : fileManagerNotebooks.length === 0 ? (
                <p className="text-hawk-400">
                  No notebook folders for this event yet. Create the event with
                  notebook templates first.
                </p>
              ) : (
                <ul className="space-y-4">
                  {fileManagerNotebooks.map((notebook) => (
                    <li key={notebook.notebookId}>
                      <SeedFileExplorer
                        apiBase={`/api/admin/events/${fileManagerEvent.slug}/notebooks/${notebook.notebookId}/files`}
                        title={
                          notebook.pickerLabel ?? notebook.notebookTitle
                        }
                        seedPath={notebook.seedPath}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-hawk-700 px-6 py-4 text-right">
              <button
                type="button"
                onClick={closeFileManager}
                className="hawk-btn-secondary px-4 py-2 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
