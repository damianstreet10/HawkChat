/**
 * Who may open events/notebooks and who may chat (active window vs view-only).
 * Look here for "notebook not found"/403 on chat, empty home lists for guests,
 * or LAN demo (HAWKCHAT_LAN_DEMO) vs event-membership mismatches.
 */
import type { AuthUser } from "./auth";
import { AuthError } from "./auth";
import {
  getEventBySlug,
  getEventNotebookIds,
  getUserEvents,
  isEventChatOpen,
  isUserEventMember,
  listEvents,
  withEventStatus,
} from "./events";
import { getLanDemoNotebookIds } from "./lan-demo-scope";
import { canManageNotebooks, isStaffPortalRole } from "./permissions";

/** Staff: any registered event; others: enrolled members only (never anonymous). */
export function canAccessEvent(user: AuthUser, eventSlug: string): boolean {
  if (isStaffPortalRole(user.role)) {
    return Boolean(getEventBySlug(eventSlug));
  }
  if (user.id === "anonymous") return false;
  return isUserEventMember(user.id, eventSlug);
}

/** Events the user may open: all for staff, membership only otherwise. */
export function listAccessibleEvents(user: AuthUser) {
  if (isStaffPortalRole(user.role)) {
    return listEvents();
  }
  if (user.id === "anonymous") return [];
  return getUserEvents(user.id);
}

export function listAccessibleEventsWithStatus(user: AuthUser) {
  return listAccessibleEvents(user).map(withEventStatus);
}

/** Notebook IDs that appear in any registered event manifest. */
export function getAllEventNotebookIds(): Set<string> {
  const ids = new Set<string>();
  for (const event of listEvents()) {
    for (const id of getEventNotebookIds(event.slug)) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * Notebooks the user may list/open.
 * - Admin / monitor: all notebooks (returns null = unrestricted)
 * - Event members: notebooks from events they are enrolled in
 * - LAN demo guests: main seed notebooks only
 * - Contributors: also orphan notebooks not tied to an event
 */
export function getAccessibleNotebookIds(user: AuthUser): Set<string> | null {
  if (isStaffPortalRole(user.role)) {
    return null;
  }

  const ids = new Set<string>();

  if (user.id === "anonymous") {
    if (process.env.HAWKCHAT_LAN_DEMO === "true") {
      for (const id of getLanDemoNotebookIds()) ids.add(id);
    }
    return ids;
  }

  for (const event of getUserEvents(user.id)) {
    for (const id of getEventNotebookIds(event.slug)) {
      ids.add(id);
    }
  }

  return ids;
}

/** Whether the user may open/list this notebook (chat may still be blocked). */
export function canAccessNotebook(user: AuthUser, notebookId: string): boolean {
  if (isStaffPortalRole(user.role)) return true;

  if (user.id === "anonymous") {
    return (
      process.env.HAWKCHAT_LAN_DEMO === "true" &&
      getLanDemoNotebookIds().includes(notebookId)
    );
  }

  for (const event of getUserEvents(user.id)) {
    if (getEventNotebookIds(event.slug).includes(notebookId)) {
      return true;
    }
  }

  if (canManageNotebooks(user.role)) {
    return !getAllEventNotebookIds().has(notebookId);
  }

  return false;
}

/**
 * Ask questions only on active projects (staff always may chat).
 * Past / upcoming enrollments remain viewable via canAccessNotebook.
 */
export function canChatOnNotebook(user: AuthUser, notebookId: string): boolean {
  if (isStaffPortalRole(user.role)) return true;

  if (user.id === "anonymous") {
    return (
      process.env.HAWKCHAT_LAN_DEMO === "true" &&
      getLanDemoNotebookIds().includes(notebookId)
    );
  }

  if (!canAccessNotebook(user, notebookId)) return false;

  let inEvent = false;
  for (const event of listAccessibleEvents(user)) {
    if (!getEventNotebookIds(event.slug).includes(notebookId)) continue;
    inEvent = true;
    if (isEventChatOpen(event)) return true;
  }

  if (!inEvent && canManageNotebooks(user.role)) {
    return !getAllEventNotebookIds().has(notebookId);
  }

  return false;
}

/** Apply getAccessibleNotebookIds rules to a notebook list (staff = all). */
export function filterAccessibleNotebooks<T extends { id: string }>(
  user: AuthUser,
  notebooks: T[],
): T[] {
  const allowed = getAccessibleNotebookIds(user);
  if (allowed === null) return notebooks;

  if (canManageNotebooks(user.role) && user.id !== "anonymous") {
    const eventNotebooks = getAllEventNotebookIds();
    return notebooks.filter(
      (nb) => allowed.has(nb.id) || !eventNotebooks.has(nb.id),
    );
  }

  return notebooks.filter((nb) => allowed.has(nb.id));
}

/** Throw if the user cannot open this notebook (list/view). */
export function requireNotebookAccess(
  user: AuthUser,
  notebookId: string,
): void {
  if (!canAccessNotebook(user, notebookId)) {
    throw new AuthError("You do not have access to this notebook", 403);
  }
}

/** Throw if browse is OK but the project window blocks new questions. */
export function requireNotebookChat(user: AuthUser, notebookId: string): void {
  requireNotebookAccess(user, notebookId);
  if (!canChatOnNotebook(user, notebookId)) {
    throw new AuthError(
      "This project is not active. You can browse notebooks but cannot ask new questions.",
      403,
    );
  }
}
