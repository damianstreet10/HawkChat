import { getDb } from "./db";
import { isStaffPortalRole } from "./permissions";
import { getEventManifestNotebooks } from "./world-cup-event";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
};

export function getEventBySlug(slug: string): EventRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, slug, title, description, created_at FROM events WHERE slug = ?`,
    )
    .get(slug) as EventRow | undefined;
  return row ?? null;
}

export function getEventById(id: string): EventRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, slug, title, description, created_at FROM events WHERE id = ?`,
    )
    .get(id) as EventRow | undefined;
  return row ?? null;
}

export function listEvents(): EventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, slug, title, description, created_at FROM events ORDER BY title`,
    )
    .all() as EventRow[];
}

export function getUserEvents(userId: string): EventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.id, e.slug, e.title, e.description, e.created_at
       FROM events e
       JOIN event_members em ON em.event_id = e.id
       WHERE em.user_id = ?
       ORDER BY e.title`,
    )
    .all(userId) as EventRow[];
}

export function isUserEventMember(userId: string, eventSlug: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1
       FROM event_members em
       JOIN events e ON e.id = em.event_id
       WHERE em.user_id = ? AND e.slug = ?
       LIMIT 1`,
    )
    .get(userId, eventSlug);
  return Boolean(row);
}

export function getEventNotebookIds(slug: string): string[] {
  return getEventManifestNotebooks(slug).map((n) => n.notebookId);
}

export function isNotebookInEvent(notebookId: string, eventSlug: string): boolean {
  return getEventNotebookIds(eventSlug).includes(notebookId);
}

export function userCanAccessNotebook(
  userId: string | null,
  notebookId: string,
  eventSlug: string | null,
): boolean {
  if (!eventSlug) return true;
  if (!isNotebookInEvent(notebookId, eventSlug)) return false;
  if (!userId) return false;
  return isUserEventMember(userId, eventSlug);
}

/** Staff login landing — admins/monitors always pick an event first. */
export function loginRedirectForUser(
  userId: string,
  role: string,
): string | null {
  if (isStaffPortalRole(role)) {
    return listEvents().length > 0 ? "/events" : null;
  }

  const events = getUserEvents(userId);
  if (events.length === 0) return null;
  if (events.length === 1) return `/events/${events[0].slug}`;
  return "/events";
}
