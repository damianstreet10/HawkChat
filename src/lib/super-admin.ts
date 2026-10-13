/**
 * Super-admin detection from HAWKCHAT_SUPER_ADMIN_EMAIL / ADMIN_EMAIL / ADMINS.
 * Look here when promoting/demoting admins is blocked, or ownership of events
 * unexpectedly includes/excludes an env-listed email.
 */
import type { AuthUser } from "./auth";
import { AuthError } from "./auth";

/** Emails configured as owners in .env (may grant/revoke admin). */
export function getSuperAdminEmails(): string[] {
  const emails = new Set<string>();

  const explicit = process.env.HAWKCHAT_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (explicit) emails.add(explicit);

  const primary = process.env.HAWKCHAT_ADMIN_EMAIL?.trim().toLowerCase();
  if (primary) emails.add(primary);

  const multi = process.env.HAWKCHAT_ADMINS?.trim();
  if (multi) {
    for (const part of multi.split(",")) {
      const bit = part.trim();
      if (!bit) continue;
      const colon = bit.indexOf(":");
      const email = (
        colon === -1 ? bit : bit.slice(0, colon)
      )
        .trim()
        .toLowerCase();
      if (email.includes("@")) emails.add(email);
    }
  }

  return Array.from(emails);
}

/** @deprecated Prefer getSuperAdminEmails — kept for demote/delete guards. */
export function getSuperAdminEmail(): string | null {
  return getSuperAdminEmails()[0] ?? null;
}

/** True when the user's email is listed as a super admin and role is admin. */
export function isSuperAdmin(user: Pick<AuthUser, "email" | "role">): boolean {
  if (user.role !== "admin") return false;
  const owners = getSuperAdminEmails();
  if (owners.length === 0) return false;
  return owners.includes(user.email.trim().toLowerCase());
}

/** Super admins may grant/revoke the admin role on other users. */
export function canManageAdminRoles(user: AuthUser): boolean {
  return isSuperAdmin(user);
}

/** Throw 403 unless the user is a super admin. */
export function requireSuperAdmin(user: AuthUser): void {
  if (!canManageAdminRoles(user)) {
    throw new AuthError(
      "Only a super admin can grant or remove admin privileges",
      403,
    );
  }
}
