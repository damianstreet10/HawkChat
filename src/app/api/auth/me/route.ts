/**
 * GET /api/auth/me — current user, accessible events, and UI permission flags.
 * Callers: app shell / auth bootstrap. Debug here for wrong role permissions,
 * empty events list, or authRequired vs guest/signed-out payload shape.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
  isAuthRequired,
} from "@/lib/auth";
import { listAccessibleEvents } from "@/lib/event-access";
import { canManageUsers, canUploadSources, canViewActivity } from "@/lib/permissions";
import { canManageAdminRoles } from "@/lib/super-admin";
import type { AuthUser } from "@/lib/auth";

function permissionsFor(user: AuthUser) {
  const isSuper = canManageAdminRoles(user);
  return {
    canUpload: canUploadSources(user.role),
    canManageNotebooks: user.role !== "viewer" && user.role !== "monitor",
    canManageUsers: canManageUsers(user.role),
    canViewActivity: canViewActivity(user.role),
    /** Env-listed super admin: grant/revoke Admin + delete people entirely. */
    canManageAdminRoles: isSuper,
    canDeleteUsers: isSuper,
  };
}

const GUEST_PERMISSIONS = {
  canUpload: true,
  canManageNotebooks: true,
  canManageUsers: false,
  canViewActivity: false,
  canManageAdminRoles: false,
  canDeleteUsers: false,
};

const SIGNED_OUT_PERMISSIONS = {
  canUpload: false,
  canManageNotebooks: false,
  canManageUsers: false,
  canViewActivity: false,
  canManageAdminRoles: false,
  canDeleteUsers: false,
};

/** Return auth state + permissions for the current session (or guest when auth off). */
export async function GET(request: Request) {
  try {
    const authRequired = isAuthRequired();
    const user = getAuthUserFromRequest(request);

    if (!authRequired) {
      return NextResponse.json({
        authenticated: Boolean(user),
        authRequired: false,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            }
          : null,
        events: user ? listAccessibleEvents(user) : [],
        permissions: user ? permissionsFor(user) : GUEST_PERMISSIONS,
      });
    }

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        authRequired: true,
        user: null,
        events: [],
        permissions: SIGNED_OUT_PERMISSIONS,
      });
    }

    return NextResponse.json({
      authenticated: true,
      authRequired: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      events: listAccessibleEvents(user),
      permissions: permissionsFor(user),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
