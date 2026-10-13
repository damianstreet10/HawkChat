/**
 * Role ranks and capability helpers (upload, notebooks, users, activity, staff portal).
 * Look here when a role can/can't perform an action — note monitor ranks with viewer
 * for hasMinRole but is staff for activity/portal checks.
 */
export type Role = "viewer" | "contributor" | "admin" | "monitor";

const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  monitor: 1,
  contributor: 2,
  admin: 3,
};

/** Numeric role ladder; monitor == viewer rank (staff checks are separate). */
export function hasMinRole(userRole: Role, required: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[required];
}

/** Contributor+: upload sources (viewers/monitors cannot). */
export function canUploadSources(role: Role): boolean {
  return hasMinRole(role, "contributor");
}

/** Contributor+: create/rename/delete notebooks. */
export function canManageNotebooks(role: Role): boolean {
  return hasMinRole(role, "contributor");
}

/** Admin only — invite/role changes for users. */
export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/** Pre-approved staff only — not guests or normal signed-in viewers. */
export function canViewActivity(role: Role): boolean {
  return role === "admin" || role === "monitor";
}

/** Admin or monitor — staff portal / event admin surfaces. */
export function isStaffPortalRole(role: string): boolean {
  return role === "admin" || role === "monitor";
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "View only — chat only",
  monitor: "Monitor — view guest questions & IPs only",
  contributor: "Contributor — upload sources & manage notebooks",
  admin: "Admin — manage users + contributor access",
};
