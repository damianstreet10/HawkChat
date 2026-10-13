"use client";

/**
 * Admin “Manage events” — create/edit projects, notebooks, members, seed files.
 * Debug create failures, template/custom notebook provisioning, member enroll,
 * or modal actions (edit/delete/file manager/members) — APIs under `/api/admin/events`.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { SeedFileExplorer } from "@/components/SeedFileExplorer";
import { MemberEmailPicker } from "@/components/MemberEmailPicker";
import { useSession } from "@/hooks/useSession";
import { WORLD_CUP_EVENT_SLUG } from "@/lib/world-cup-constants";
import {
  NOTEBOOK_TEMPLATE_IDS,
  notebookTemplateHasSeedFiles,
  type NotebookTemplateId,
} from "@/lib/notebook-templates";
import {
  EVENT_DEPARTMENTS,
  EVENT_DEPARTMENT_LABELS,
  departmentLabel,
  departmentStyle,
  type EventDepartment,
} from "@/lib/event-departments";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  notebookCount?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  dateRangeLabel?: string | null;
  timeStatus?: string;
  department?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  canEdit?: boolean;
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

type CustomNotebookDraft = {
  key: string;
  title: string;
  description: string;
  files: File[];
};

type EventMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  enrolled_at: string;
};

export default function AdminEventsPage() {
  const session = useSession();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [department, setDepartment] = useState<EventDepartment | "">(
    "football-events",
  );
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
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
  const [customNotebooks, setCustomNotebooks] = useState<CustomNotebookDraft[]>(
    [],
  );
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
  const [newCustomTitle, setNewCustomTitle] = useState("");
  const [newCustomDescription, setNewCustomDescription] = useState("");
  const [addingCustomNotebook, setAddingCustomNotebook] = useState(false);
  const [membersEvent, setMembersEvent] = useState<EventRow | null>(null);
  const [members, setMembers] = useState<EventMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersMessage, setMembersMessage] = useState<string | null>(null);
  const [addMemberEmails, setAddMemberEmails] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDepartment, setEditDepartment] = useState<EventDepartment | "">(
    "",
  );
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  function addCustomNotebookDraft() {
    setCustomNotebooks((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}-${prev.length}`,
        title: "",
        description: "",
        files: [],
      },
    ]);
  }

  function updateCustomNotebookDraft(
    key: string,
    patch: Partial<Pick<CustomNotebookDraft, "title" | "description">>,
  ) {
    setCustomNotebooks((prev) =>
      prev.map((nb) => (nb.key === key ? { ...nb, ...patch } : nb)),
    );
  }

  function addFilesToCustomNotebook(key: string, fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    setCustomNotebooks((prev) =>
      prev.map((nb) => {
        if (nb.key !== key) return nb;
        const existing = new Set(nb.files.map((f) => f.name.toLowerCase()));
        const merged = [...nb.files];
        for (const file of incoming) {
          if (existing.has(file.name.toLowerCase())) continue;
          merged.push(file);
          existing.add(file.name.toLowerCase());
        }
        return { ...nb, files: merged };
      }),
    );
  }

  function removeFileFromCustomNotebook(key: string, fileName: string) {
    setCustomNotebooks((prev) =>
      prev.map((nb) =>
        nb.key === key
          ? { ...nb, files: nb.files.filter((f) => f.name !== fileName) }
          : nb,
      ),
    );
  }

  function removeCustomNotebookDraft(key: string) {
    setCustomNotebooks((prev) => prev.filter((nb) => nb.key !== key));
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

  async function loadMembers(event: EventRow) {
    setMembersLoading(true);
    setMembersError(null);
    const res = await fetch(`/api/admin/events/${event.slug}/members`);
    const data = await res.json().catch(() => ({}));
    setMembersLoading(false);
    if (!res.ok) {
      setMembers([]);
      setMembersError(data.error ?? "Could not load members.");
      return;
    }
    setMembers(data.members ?? []);
  }

  async function openMembersManager(event: EventRow) {
    setMembersEvent(event);
    setMembers([]);
    setMembersError(null);
    setMembersMessage(null);
    setAddMemberEmails([]);
    await loadMembers(event);
  }

  function closeMembersManager() {
    if (addingMembers || removingMemberId) return;
    setMembersEvent(null);
    setMembers([]);
    setMembersError(null);
    setMembersMessage(null);
    setAddMemberEmails([]);
  }

  async function addMembers(e: React.FormEvent) {
    e.preventDefault();
    if (!membersEvent) return;
    if (addMemberEmails.length === 0) {
      setMembersMessage("Add at least one email.");
      return;
    }

    setAddingMembers(true);
    setMembersMessage(null);
    setMembersError(null);
    const res = await fetch(`/api/admin/events/${membersEvent.slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: addMemberEmails }),
    });
    const data = await res.json().catch(() => ({}));
    setAddingMembers(false);

    if (!res.ok) {
      setMembersError(data.error ?? "Could not add members.");
      return;
    }

    const parts: string[] = [];
    if (data.added?.length) {
      parts.push(`Added: ${data.added.join(", ")}`);
    }
    if (data.alreadyMembers?.length) {
      parts.push(`Already enrolled: ${data.alreadyMembers.join(", ")}`);
    }
    setMembersMessage(parts.join(". ") || "No changes.");
    setAddMemberEmails([]);
    await loadMembers(membersEvent);
  }

  async function removeMember(member: EventMember) {
    if (!membersEvent) return;
    setRemovingMemberId(member.id);
    setMembersError(null);
    const res = await fetch(
      `/api/admin/events/${membersEvent.slug}/members/${member.id}`,
      { method: "DELETE" },
    );
    const data = await res.json().catch(() => ({}));
    setRemovingMemberId(null);
    if (!res.ok) {
      setMembersError(data.error ?? "Could not remove member.");
      return;
    }
    setMembersMessage(`Removed ${member.email}.`);
    await loadMembers(membersEvent);
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMessage(null);

    const customs = customNotebooks
      .map((nb) => ({
        clientKey: nb.key,
        title: nb.title.trim(),
        description: nb.description.trim(),
        files: nb.files,
      }))
      .filter((nb) => nb.title);

    if (selectedTemplates.size === 0 && customs.length === 0) {
      setCreateMessage(
        "Select at least one template notebook or add a custom notebook.",
      );
      setCreating(false);
      return;
    }

    if (!department) {
      setCreateMessage("Select a department for this project.");
      setCreating(false);
      return;
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        description,
        department,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        memberEmails,
        notebookTemplates: Array.from(selectedTemplates),
        customNotebooks: customs.map(({ clientKey, title, description }) => ({
          clientKey,
          title,
          description,
        })),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setCreating(false);
      setCreateMessage(data.error ?? "Could not create event.");
      return;
    }

    const created: EventRow = {
      id: data.id,
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      department: data.department ?? department,
      created_by: data.created_by ?? session.user?.id ?? null,
      created_by_name: data.created_by_name ?? session.user?.name ?? null,
      created_by_email: data.created_by_email ?? session.user?.email ?? null,
      canEdit: true,
      notebookCount: (data.notebooks ?? []).length,
    };

    const provisionedCustoms = Array.isArray(data.customNotebooks)
      ? (data.customNotebooks as Array<{
          clientKey?: string;
          notebookId: string;
          title: string;
        }>)
      : [];

    let uploadedCount = 0;
    const uploadErrors: string[] = [];
    for (const custom of customs) {
      if (custom.files.length === 0) continue;
      const match =
        provisionedCustoms.find((p) => p.clientKey === custom.clientKey) ??
        provisionedCustoms.find(
          (p) => p.title.toLowerCase() === custom.title.toLowerCase(),
        );
      if (!match) {
        uploadErrors.push(`Could not match notebook "${custom.title}" for uploads.`);
        continue;
      }
      for (const file of custom.files) {
        const form = new FormData();
        form.append("file", file);
        const up = await fetch(
          `/api/admin/events/${created.slug}/notebooks/${match.notebookId}/files`,
          { method: "POST", body: form },
        );
        if (!up.ok) {
          const errBody = await up.json().catch(() => ({}));
          uploadErrors.push(
            errBody.error ?? `Failed to upload ${file.name} to ${custom.title}.`,
          );
        } else {
          uploadedCount += 1;
        }
      }
    }

    setCreating(false);
    setCreateMessage(
      `Created "${data.title}" with ${(data.notebooks ?? []).join(", ") || "no notebooks"}.` +
        (data.copiedFiles
          ? ` Copied ${data.copiedFiles} template document(s).`
          : "") +
        (uploadedCount
          ? ` Uploaded ${uploadedCount} file(s) to custom notebooks.`
          : "") +
        (uploadErrors.length ? ` ${uploadErrors.join(" ")}` : "") +
        ` Members added: ${(data.membersAdded ?? []).join(", ") || "none"}.`,
    );
    setSlug("");
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setDepartment("football-events");
    setMemberEmails([]);
    setCustomNotebooks([]);
    setSelectedTemplates(new Set(NOTEBOOK_TEMPLATE_IDS));
    await load();
    if (customs.length > 0) {
      await openFileManager(created);
    }
  }

  async function addCustomNotebookToOpenEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!fileManagerEvent) return;
    const notebookTitle = newCustomTitle.trim();
    if (!notebookTitle) {
      setFileManagerError("Enter a notebook name.");
      return;
    }

    setAddingCustomNotebook(true);
    setFileManagerError(null);
    const res = await fetch(
      `/api/admin/events/${fileManagerEvent.slug}/notebooks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: notebookTitle,
          description: newCustomDescription.trim(),
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    setAddingCustomNotebook(false);

    if (!res.ok) {
      setFileManagerError(data.error ?? "Could not add custom notebook.");
      return;
    }

    setNewCustomTitle("");
    setNewCustomDescription("");
    await openFileManager(fileManagerEvent);
  }

  function openDeleteDialog(event: EventRow) {
    setPendingDelete(event);
    setDeleteConfirm("");
    setDeleteError(null);
  }

  function openEditDialog(event: EventRow) {
    setEditingEvent(event);
    setEditTitle(event.title);
    setEditDescription(event.description ?? "");
    setEditDepartment(
      (event.department as EventDepartment | null) ?? "football-events",
    );
    setEditStartsAt(event.starts_at ?? "");
    setEditEndsAt(event.ends_at ?? "");
    setEditError(null);
  }

  function closeEditDialog() {
    setEditingEvent(null);
    setEditError(null);
  }

  async function saveEventEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEvent || !editDepartment) return;
    setSavingEdit(true);
    setEditError(null);
    const res = await fetch(`/api/events/${editingEvent.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription,
        department: editDepartment,
        startsAt: editStartsAt || null,
        endsAt: editEndsAt || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingEdit(false);
    if (!res.ok) {
      setEditError(data.error ?? "Could not save changes.");
      return;
    }
    closeEditDialog();
    await load();
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
          Create project spaces with their own notebooks. Add member emails —
          they create an account with a password, then you enroll them so they see
          the projects they are assigned to.
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
            {/* --- Create event form (templates, custom notebooks, members) --- */}
            <form onSubmit={createEvent} className="hawk-card mb-10 space-y-4 p-6">
              <h3 className="font-display text-lg font-bold text-hawk-50">
                Create event
              </h3>
              <p className="text-xs text-hawk-400">
                You will be tagged as the creator. Only you and a super admin can
                edit the event afterward.
              </p>
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
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) =>
                    setDepartment(e.target.value as EventDepartment | "")
                  }
                  required
                  className="hawk-input w-full px-3 py-2 text-sm"
                >
                  {EVENT_DEPARTMENTS.map((id) => (
                    <option key={id} value={id}>
                      {EVENT_DEPARTMENT_LABELS[id]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-hawk-400">
                  Shown as a colored label on Your projects and used for
                  filtering.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    min={startsAt || undefined}
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-hawk-400">
                Members can ask questions only between these dates. Leave blank
                for always-active. After the end date, the project stays visible
                as Previous (browse only).
              </p>
              <fieldset className="space-y-3">
                <legend className="mb-1 block text-sm font-medium text-hawk-200">
                  Notebooks
                </legend>
                <p className="text-xs text-hawk-400">
                  Choose shared template notebooks (copied into this project),
                  and/or add custom notebooks below with documents. You can also
                  manage files later from each project.
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

                <div className="rounded-lg border border-hawk-600 bg-hawk-900/40 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-hawk-50">
                        Custom notebooks
                      </p>
                      <p className="mt-0.5 text-xs text-hawk-400">
                        For project-specific content. Set a name, description,
                        and optionally upload documents now.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCustomNotebookDraft}
                      className="hawk-btn-secondary px-3 py-1.5 text-xs"
                    >
                      + Add custom notebook
                    </button>
                  </div>
                  {customNotebooks.length === 0 ? (
                    <p className="text-xs text-hawk-500">
                      No custom notebooks yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {customNotebooks.map((nb) => (
                        <li
                          key={nb.key}
                          className="space-y-2 rounded-lg border border-hawk-700 bg-hawk-950/50 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="block min-w-0 flex-1 text-sm text-hawk-200">
                              Name
                              <input
                                value={nb.title}
                                onChange={(e) =>
                                  updateCustomNotebookDraft(nb.key, {
                                    title: e.target.value,
                                  })
                                }
                                required
                                placeholder="e.g. Venue logistics"
                                className="hawk-input mt-1 w-full px-3 py-2 text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeCustomNotebookDraft(nb.key)}
                              className="mt-6 shrink-0 rounded-lg border border-orange/40 bg-orange/10 px-3 py-1.5 text-xs text-orange-light"
                            >
                              Remove
                            </button>
                          </div>
                          <label className="block text-sm text-hawk-200">
                            Description
                            <textarea
                              value={nb.description}
                              onChange={(e) =>
                                updateCustomNotebookDraft(nb.key, {
                                  description: e.target.value,
                                })
                              }
                              rows={2}
                              placeholder="What this notebook is for"
                              className="hawk-input mt-1 w-full px-3 py-2 text-sm"
                            />
                          </label>
                          <div className="rounded-md border border-hawk-700 bg-hawk-950/60 p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-widest text-hawk-400">
                                Documents
                              </p>
                              <label className="hawk-btn-secondary cursor-pointer px-3 py-1.5 text-xs">
                                Add files
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                                  className="hidden"
                                  onChange={(e) => {
                                    addFilesToCustomNotebook(
                                      nb.key,
                                      e.target.files,
                                    );
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                            {nb.files.length === 0 ? (
                              <p className="text-xs text-hawk-500">
                                No files staged yet. You can also add more later
                                via Manage files.
                              </p>
                            ) : (
                              <ul className="space-y-1">
                                {nb.files.map((file) => (
                                  <li
                                    key={file.name}
                                    className="flex items-center justify-between gap-2 text-sm text-hawk-200"
                                  >
                                    <span className="truncate">
                                      {file.name}
                                      <span className="ml-2 text-xs text-hawk-500">
                                        ({Math.max(1, Math.round(file.size / 1024))}{" "}
                                        KB)
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeFileFromCustomNotebook(
                                          nb.key,
                                          file.name,
                                        )
                                      }
                                      className="shrink-0 text-xs text-orange-light hover:underline"
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </fieldset>
              <MemberEmailPicker
                emails={memberEmails}
                onChange={setMemberEmails}
              />
              {createMessage && (
                <p className="text-sm text-hawk-200">{createMessage}</p>
              )}
              <button
                type="submit"
                disabled={
                  creating ||
                  (selectedTemplates.size === 0 &&
                    customNotebooks.every((nb) => !nb.title.trim()))
                }
                className="hawk-btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create event"}
              </button>
            </form>

            {/* --- Existing events list --- */}
            <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-orange">
              Existing events
            </h3>
            {events.length === 0 ? (
              <p className="text-hawk-400">No events yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => {
                  const canEdit = Boolean(event.canEdit);
                  const createdBy =
                    event.created_by_name ||
                    event.created_by_email ||
                    null;
                  return (
                  <li key={event.id} className="hawk-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-lg font-bold text-hawk-50">
                            {event.title}
                          </h4>
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${departmentStyle(event.department)}`}
                          >
                            {departmentLabel(event.department)}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs text-hawk-400">
                          /events/{event.slug}
                        </p>
                        {createdBy && (
                          <p className="mt-1 text-xs text-hawk-300">
                            Created by{" "}
                            <span className="font-medium text-hawk-100">
                              {createdBy}
                            </span>
                          </p>
                        )}
                        {event.description && (
                          <p className="mt-2 text-sm text-hawk-300">
                            {event.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-hawk-400">
                          {event.dateRangeLabel
                            ? `${event.dateRangeLabel} · `
                            : ""}
                          {event.notebookCount ?? 0} notebook(s)
                          {event.timeStatus === "past"
                            ? " · Previous"
                            : event.timeStatus === "upcoming"
                              ? " · Upcoming"
                              : " · Active"}
                          {!canEdit ? " · View only for you" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/events/${event.slug}`}
                          className="hawk-btn-secondary px-4 py-2 text-sm"
                        >
                          Open space
                        </Link>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditDialog(event)}
                              className="hawk-btn-secondary px-4 py-2 text-sm"
                            >
                              Edit event
                            </button>
                            <button
                              type="button"
                              onClick={() => openMembersManager(event)}
                              className="hawk-btn-secondary px-4 py-2 text-sm"
                            >
                              Manage members
                            </button>
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
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      {/* --- Edit event modal --- */}
      {editingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hawk-950/80 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-event-title"
        >
          <form
            onSubmit={saveEventEdit}
            className="hawk-card w-full max-w-lg p-6"
          >
            <h3
              id="edit-event-title"
              className="font-display text-lg font-bold text-hawk-50"
            >
              Edit event
            </h3>
            <p className="mt-1 text-sm text-hawk-400">
              /events/{editingEvent.slug}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-hawk-200">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="hawk-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-hawk-200">
                  Department
                </label>
                <select
                  value={editDepartment}
                  onChange={(e) =>
                    setEditDepartment(e.target.value as EventDepartment | "")
                  }
                  required
                  className="hawk-input w-full px-3 py-2 text-sm"
                >
                  {EVENT_DEPARTMENTS.map((id) => (
                    <option key={id} value={id}>
                      {EVENT_DEPARTMENT_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-hawk-200">
                    End date
                  </label>
                  <input
                    type="date"
                    value={editEndsAt}
                    onChange={(e) => setEditEndsAt(e.target.value)}
                    min={editStartsAt || undefined}
                    className="hawk-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            {editError && (
              <p className="mt-3 text-sm text-orange-light">{editError}</p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeEditDialog}
                disabled={savingEdit}
                className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit || !editTitle.trim() || !editDepartment}
                className="hawk-btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Delete event confirmation modal --- */}
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

      {/* --- File manager modal (per-notebook seed files) --- */}
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
              ) : (
                <>
                  {fileManagerError && (
                    <p className="mb-4 text-orange-light">{fileManagerError}</p>
                  )}

                  <form
                    onSubmit={addCustomNotebookToOpenEvent}
                    className="mb-6 space-y-3 rounded-lg border border-hawk-600 bg-hawk-900/40 p-4"
                  >
                    <p className="text-sm font-semibold text-hawk-50">
                      Add custom notebook
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-hawk-200">
                        Name
                        <input
                          value={newCustomTitle}
                          onChange={(e) => setNewCustomTitle(e.target.value)}
                          placeholder="e.g. Broadcast workflow"
                          className="hawk-input mt-1 w-full px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm text-hawk-200">
                        Description
                        <input
                          value={newCustomDescription}
                          onChange={(e) =>
                            setNewCustomDescription(e.target.value)
                          }
                          placeholder="Optional"
                          className="hawk-input mt-1 w-full px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={addingCustomNotebook || !newCustomTitle.trim()}
                      className="hawk-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                    >
                      {addingCustomNotebook ? "Adding…" : "Add notebook"}
                    </button>
                  </form>

                  {fileManagerNotebooks.length === 0 ? (
                    <p className="text-hawk-400">
                      No notebook folders yet. Add a custom notebook above or
                      recreate the event with templates.
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
                </>
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

      {/* --- Manage members modal --- */}
      {membersEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-hawk-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="members-manager-title"
        >
          <div className="hawk-card flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden">
            <div className="border-b border-hawk-700 px-6 py-4">
              <h3
                id="members-manager-title"
                className="font-display text-lg font-bold text-hawk-50"
              >
                Members — {membersEvent.title}
              </h3>
              <p className="mt-1 text-sm text-hawk-300">
                Enrolled people sign in with email only. New emails create
                accounts automatically.
              </p>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              <form onSubmit={addMembers} className="space-y-3">
                <MemberEmailPicker
                  emails={addMemberEmails}
                  onChange={setAddMemberEmails}
                  excludeEmails={members.map((m) => m.email)}
                  label="Add members"
                />
                <button
                  type="submit"
                  disabled={addingMembers || addMemberEmails.length === 0}
                  className="hawk-btn-primary px-4 py-2 text-sm disabled:opacity-60"
                >
                  {addingMembers ? "Adding…" : "Add members"}
                </button>
              </form>

              {membersMessage && (
                <p className="text-sm text-hawk-200">{membersMessage}</p>
              )}
              {membersError && (
                <p className="text-sm text-orange-light">{membersError}</p>
              )}

              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-widest text-orange">
                  Current members ({members.length})
                </h4>
                {membersLoading ? (
                  <p className="text-hawk-400">Loading…</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-hawk-400">
                    No members enrolled yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((member) => (
                      <li
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hawk-700 bg-hawk-900/50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-hawk-50">
                            {member.email}
                          </p>
                          <p className="text-xs text-hawk-400">
                            {member.name} · {member.role}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member)}
                          disabled={removingMemberId === member.id}
                          className="shrink-0 rounded-lg border border-orange/40 bg-orange/10 px-3 py-1.5 text-xs font-medium text-orange-light transition hover:bg-orange/15 disabled:opacity-60"
                        >
                          {removingMemberId === member.id
                            ? "Removing…"
                            : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="border-t border-hawk-700 px-6 py-4 text-right">
              <button
                type="button"
                onClick={closeMembersManager}
                disabled={addingMembers || Boolean(removingMemberId)}
                className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
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
