export type Role = "viewer" | "contributor" | "admin" | "monitor";

const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  monitor: 1,
  contributor: 2,
  admin: 3,
};

export function hasMinRole(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

/** View-only: chat and read sources, no uploads or notebook management */
export function canUploadSources(role: Role): boolean {
  return hasMinRole(role, "contributor");
}

export function canManageNotebooks(role: Role): boolean {
  return hasMinRole(role, "contributor");
}

export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/** Pre-approved staff only — not guests or normal signed-in viewers. */
export function canViewActivity(role: Role): boolean {
  return role === "admin" || role === "monitor";
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "View only — chat only",
  monitor: "Monitor — view guest questions & IPs only",
  contributor: "Contributor — upload sources & manage notebooks",
  admin: "Admin — manage users + contributor access",
};
