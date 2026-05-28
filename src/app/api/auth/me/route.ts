import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
  isAuthRequired,
} from "@/lib/auth";
import { canManageUsers, canUploadSources, canViewActivity } from "@/lib/permissions";

function permissionsFor(role: "viewer" | "contributor" | "admin" | "monitor") {
  return {
    canUpload: canUploadSources(role),
    canManageNotebooks: role !== "viewer" && role !== "monitor",
    canManageUsers: canManageUsers(role),
    canViewActivity: canViewActivity(role),
  };
}

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
        permissions: user
          ? permissionsFor(user.role)
          : {
              canUpload: true,
              canManageNotebooks: true,
              canManageUsers: false,
              canViewActivity: false,
            },
      });
    }

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        authRequired: true,
        user: null,
        permissions: {
          canUpload: false,
          canManageNotebooks: false,
          canManageUsers: false,
          canViewActivity: false,
        },
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
      permissions: permissionsFor(user.role),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
