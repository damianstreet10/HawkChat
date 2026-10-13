"use client";

/**
 * Autocomplete multi-email picker for event member enrollment.
 * Debug chip add/remove, suggestions from `/api/users`, or outside-click close.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function looksLikeEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return Boolean(email && email.includes("@") && !email.includes(" "));
}

export function MemberEmailPicker({
  emails,
  onChange,
  excludeEmails = [],
  label = "Member emails",
  hint = "Search registered users and press Add. People must create their own account before you can enroll them.",
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  /** Already enrolled — hide from search results. */
  excludeEmails?: string[];
  label?: string;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users;
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const selected = useMemo(
    () => new Set(emails.map(normalizeEmail)),
    [emails],
  );
  const excluded = useMemo(
    () => new Set(excludeEmails.map(normalizeEmail)),
    [excludeEmails],
  );

  const matches = useMemo(() => {
    const q = normalizeEmail(query);
    return users
      .filter((u) => {
        const email = normalizeEmail(u.email);
        if (selected.has(email) || excluded.has(email)) return false;
        if (!q) return true;
        return (
          email.includes(q) ||
          u.name.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [users, query, selected, excluded]);

  function addEmail(raw: string) {
    const email = normalizeEmail(raw);
    if (!looksLikeEmail(email)) return;
    const known = users.some((u) => normalizeEmail(u.email) === email);
    if (!known) return;
    if (selected.has(email) || excluded.has(email)) {
      setQuery("");
      setOpen(false);
      return;
    }
    onChange([...emails, email]);
    setQuery("");
    setOpen(false);
  }

  function removeEmail(email: string) {
    const target = normalizeEmail(email);
    onChange(emails.filter((e) => normalizeEmail(e) !== target));
  }

  const typedIsKnown = users.some(
    (u) => normalizeEmail(u.email) === normalizeEmail(query),
  );

  const canAddTyped =
    looksLikeEmail(query) &&
    typedIsKnown &&
    !selected.has(normalizeEmail(query)) &&
    !excluded.has(normalizeEmail(query));

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label className="mb-1 block text-sm text-hawk-200">{label}</label>

      {emails.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {emails.map((email) => (
            <li
              key={email}
              className="flex items-center gap-1.5 rounded-lg border border-hawk-600 bg-hawk-900/70 px-2.5 py-1 text-sm text-hawk-100"
            >
              <span className="max-w-[14rem] truncate">{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="text-hawk-400 transition hover:text-orange-light"
                aria-label={`Remove ${email}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canAddTyped) addEmail(query);
                else if (matches[0]) addEmail(matches[0].email);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search registered users…"
            className="hawk-input w-full px-3 py-2 text-sm"
            autoComplete="off"
          />

          {open && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-hawk-600 bg-hawk-950 shadow-lg">
              {loadingUsers ? (
                <p className="px-3 py-2 text-sm text-hawk-400">Loading users…</p>
              ) : matches.length > 0 ? (
                <ul>
                  {matches.map((user) => (
                    <li key={user.id}>
                      <button
                        type="button"
                        onClick={() => addEmail(user.email)}
                        className="flex w-full flex-col items-start px-3 py-2 text-left transition hover:bg-hawk-800"
                      >
                        <span className="text-sm text-hawk-50">{user.email}</span>
                        <span className="text-xs text-hawk-400">
                          {user.name} · {user.role}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-hawk-400">
                  {query.trim()
                    ? "No matching accounts. They must create an account first."
                    : "No users available to add."}
                </p>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => addEmail(query)}
          disabled={!canAddTyped}
          className="hawk-btn-secondary shrink-0 px-4 py-2 text-sm disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <p className="text-xs text-hawk-400">{hint}</p>
    </div>
  );
}
