"use client";

/**
 * Admin member directory (create/edit users & roles).
 * Debug enrollment, Admin vs User role mapping, or `/api/users` CRUD failures —
 * UI only exposes Admin/User; User is stored as viewer.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffPortalHeader } from "@/components/StaffPortalHeader";
import { useSession } from "@/hooks/useSession";
import type { Role } from "@/lib/permissions";

type UserProject = {
  id: string;
  slug: string;
  title: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleLabel?: string;
  created_at: string;
  projects: UserProject[];
};

/** UI only exposes Admin vs User (User is stored as viewer). */
function displayRoleLabel(role: Role): string {
  return role === "admin" ? "Admin" : "User";
}

function toStoredRole(uiRole: "admin" | "user"): Role {
  return uiRole === "admin" ? "admin" : "viewer";
}

function toUiRole(role: Role): "admin" | "user" {
  return role === "admin" ? "admin" : "user";
}

export default function AdminMembersPage() {
  const session = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [canManageAdminRoles, setCanManageAdminRoles] = useState(false);
  const [canDeleteUsers, setCanDeleteUsers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canAccess =
    session.authenticated && session.permissions.canManageUsers;

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (!res.ok) {
      setError("Could not load users.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.users;
    setUsers(Array.isArray(list) ? list : []);
    setCanManageAdminRoles(Boolean(data.canManageAdminRoles));
    setCanDeleteUsers(
      Boolean(data.canDeleteUsers ?? data.canManageAdminRoles),
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session.loading) return;
    if (!canAccess) {
      setError("Admin sign in required.");
      setLoading(false);
      return;
    }
    load();
  }, [session.loading, canAccess, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const roleLabel = displayRoleLabel(u.role).toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        roleLabel.includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.projects.some(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q),
        )
      );
    });
  }, [users, query]);

  async function setRole(user: UserRow, role: Role) {
    // Treat any non-admin as the same "User" bucket for no-op checks.
    if (role === "admin" ? user.role === "admin" : user.role !== "admin") {
      return;
    }
    setUpdatingId(user.id);
    setMessage(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    setUpdatingId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Could not update role.");
      return;
    }
    setMessage(
      role === "admin"
        ? `Granted admin to ${user.email}.`
        : `Set ${user.email} as a user.`,
    );
    await load();
  }

  async function confirmDeleteUser() {
    if (!pendingDelete) return;
    setDeleting(true);
    setMessage(null);
    const res = await fetch(`/api/users/${pendingDelete.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not remove user.");
      return;
    }
    setMessage(
      `Removed ${pendingDelete.email} entirely (account and project enrollments).`,
    );
    setPendingDelete(null);
    await load();
  }

  return (
    <div className="hawk-page min-h-screen">
      <StaffPortalHeader title="Manage members" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
          All members
        </h2>
        <p className="mb-6 text-sm text-hawk-300">
          {canManageAdminRoles
            ? "Super admin: view everyone, promote/demote Admin vs User, and remove people entirely. Users create their own password-protected accounts; enroll them on projects from Manage events."
            : "Users create their own accounts with a password. Enroll them on a project from Manage members on that project. Only a super admin can change Admin/User or remove people entirely."}
        </p>

        {session.loading || loading ? (
          <p className="text-hawk-400">Loading…</p>
        ) : error ? (
          <div className="hawk-card-muted p-8 text-center">
            <p className="mb-4 text-hawk-200">{error}</p>
            <Link
              href="/login/staff?from=/admin/members"
              className="hawk-btn-primary px-5 py-2 text-sm"
            >
              Staff sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email, name, role, or project…"
                className="hawk-input w-full px-3 py-2.5 text-sm"
              />
            </div>

            {message && (
              <p className="mb-4 text-sm text-hawk-200">{message}</p>
            )}

            {filtered.length === 0 ? (
              <p className="text-hawk-400">No users match that search.</p>
            ) : (
              <ul className="space-y-3">
                {filtered.map((user) => {
                  const isSelf = session.user?.id === user.id;
                  const uiRole = toUiRole(user.role);
                  const showRoleControls = canManageAdminRoles && !isSelf;
                  const showDelete = canDeleteUsers && !isSelf;
                  const busy = updatingId === user.id || deleting;

                  return (
                    <li key={user.id} className="hawk-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-hawk-50">
                            {user.email}
                            {isSelf ? (
                              <span className="ml-2 text-xs text-hawk-400">
                                (you)
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 text-sm text-hawk-300">
                            {user.name} · {displayRoleLabel(user.role)}
                          </p>
                          <div className="mt-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-orange">
                              Projects
                            </p>
                            {user.projects.length === 0 ? (
                              <p className="mt-1 text-sm text-hawk-400">
                                Not enrolled in any projects
                              </p>
                            ) : (
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {user.projects.map((project) => (
                                  <li key={project.id}>
                                    <Link
                                      href={`/events/${project.slug}`}
                                      className="inline-block rounded-lg border border-hawk-600 bg-hawk-900/60 px-2.5 py-1 text-xs text-hawk-100 transition hover:border-orange/50"
                                    >
                                      {project.title}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {(showRoleControls || showDelete) && (
                          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
                            {showRoleControls && (
                              <div>
                                <label className="mb-1 block text-xs text-hawk-400">
                                  Role
                                </label>
                                <select
                                  value={uiRole}
                                  disabled={busy}
                                  onChange={(e) => {
                                    const next = e.target.value as
                                      | "admin"
                                      | "user";
                                    setRole(user, toStoredRole(next));
                                  }}
                                  className="hawk-input px-3 py-2 text-sm disabled:opacity-50"
                                >
                                  <option value="user">User</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </div>
                            )}
                            {showDelete && (
                              <button
                                type="button"
                                onClick={() => setPendingDelete(user)}
                                disabled={busy}
                                className="rounded-lg border border-orange/40 bg-orange/10 px-4 py-2 text-sm font-medium text-orange-light transition hover:bg-orange/15 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Remove entirely
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
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
          aria-labelledby="delete-user-title"
        >
          <div className="hawk-card w-full max-w-md p-6">
            <h3
              id="delete-user-title"
              className="font-display text-lg font-bold text-hawk-50"
            >
              Remove user entirely?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-hawk-300">
              This permanently deletes{" "}
              <span className="font-semibold text-hawk-100">
                {pendingDelete.email}
              </span>
              , ends their sessions, and removes them from all projects. They
              will need to be enrolled again (or re-created) to sign in.
            </p>
            {pendingDelete.projects.length > 0 && (
              <p className="mt-3 text-xs text-hawk-400">
                Currently enrolled in:{" "}
                {pendingDelete.projects.map((p) => p.title).join(", ")}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deleting}
                className="rounded-lg border border-orange/50 bg-orange/20 px-4 py-2 text-sm font-medium text-orange-light transition hover:bg-orange/30 disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Remove entirely"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
