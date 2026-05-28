"use client";

import { useCallback, useEffect, useState } from "react";

export type SessionPermissions = {
  canUpload: boolean;
  canManageNotebooks: boolean;
  canManageUsers: boolean;
  canViewActivity: boolean;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "viewer" | "contributor" | "admin" | "monitor";
};

export type SessionState = {
  loading: boolean;
  authenticated: boolean;
  authRequired: boolean;
  user: SessionUser | null;
  permissions: SessionPermissions;
};

const DEFAULT_PERMISSIONS: SessionPermissions = {
  canUpload: true,
  canManageNotebooks: true,
  canManageUsers: true,
  canViewActivity: false,
};

export function useSession(): SessionState & { refresh: () => void } {
  const [state, setState] = useState<SessionState>({
    loading: true,
    authenticated: false,
    authRequired: false,
    user: null,
    permissions: DEFAULT_PERMISSIONS,
  });

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setState({
          loading: false,
          authenticated: data.authenticated,
          authRequired: data.authRequired,
          user: data.user,
          permissions: data.permissions ?? DEFAULT_PERMISSIONS,
        });
      })
      .catch(() =>
        setState({
          loading: false,
          authenticated: false,
          authRequired: false,
          user: null,
          permissions: DEFAULT_PERMISSIONS,
        }),
      );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
