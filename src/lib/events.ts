/**
 * Event CRUD, date windows, membership, and notebook-id resolution from manifests.
 * Look here when an event is missing, chat is blocked outside the project window,
 * or notebook lists don't match seed/events/{slug}/manifest.json.
 */
import { getDb } from "./db";
import { isStaffPortalRole } from "./permissions";
import { getEventManifestNotebooks } from "./world-cup-event";

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  department: string | null;
  created_by: string | null;
};

export type EventWithCreator = EventRow & {
  created_by_name: string | null;
  created_by_email: string | null;
};

export type EventTimeStatus = "active" | "upcoming" | "past";

const EVENT_SELECT =
  `id, slug, title, description, created_at, starts_at, ends_at, department, created_by`;

const EVENT_SELECT_WITH_CREATOR = `
  e.id, e.slug, e.title, e.description, e.created_at, e.starts_at, e.ends_at,
  e.department, e.created_by,
  u.name AS created_by_name, u.email AS created_by_email
`;

function mapCreatorRow(row: EventWithCreator): EventWithCreator {
  return {
    ...row,
    created_by_name: row.created_by_name ?? null,
    created_by_email: row.created_by_email ?? null,
  };
}

// --- Dates & status ---

/** Calendar day YYYY-MM-DD in UTC. */
export function todayISODate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Normalize admin date input to YYYY-MM-DD or null. */
export function parseEventDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const d = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return trimmed;
}

export function getEventTimeStatus(
  event: Pick<EventRow, "starts_at" | "ends_at">,
  now = new Date(),
): EventTimeStatus {
  const today = todayISODate(now);
  if (event.starts_at && today < event.starts_at) return "upcoming";
  if (event.ends_at && today > event.ends_at) return "past";
  return "active";
}

/** Members may ask questions only while the project window is active. */
export function isEventChatOpen(
  event: Pick<EventRow, "starts_at" | "ends_at">,
  now = new Date(),
): boolean {
  return getEventTimeStatus(event, now) === "active";
}

export function formatEventDateRange(
  event: Pick<EventRow, "starts_at" | "ends_at">,
): string | null {
  if (!event.starts_at && !event.ends_at) return null;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  if (event.starts_at && event.ends_at) {
    return `${fmt(event.starts_at)} – ${fmt(event.ends_at)}`;
  }
  if (event.starts_at) return `From ${fmt(event.starts_at)}`;
  return `Until ${fmt(event.ends_at!)}`;
}

export function withEventStatus<T extends EventRow>(event: T) {
  const timeStatus = getEventTimeStatus(event);
  return {
    ...event,
    timeStatus,
    chatOpen: timeStatus === "active",
    dateRangeLabel: formatEventDateRange(event),
  };
}

// --- Queries ---

export function getEventBySlug(slug: string): EventRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${EVENT_SELECT} FROM events WHERE slug = ?`)
    .get(slug) as EventRow | undefined;
  return row ?? null;
}

export function getEventById(id: string): EventRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT ${EVENT_SELECT} FROM events WHERE id = ?`)
    .get(id) as EventRow | undefined;
  return row ?? null;
}

export function listEvents(): EventRow[] {
  const db = getDb();
  return db
    .prepare(`SELECT ${EVENT_SELECT} FROM events ORDER BY title`)
    .all() as EventRow[];
}

export function listEventsWithCreators(): EventWithCreator[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT ${EVENT_SELECT_WITH_CREATOR}
         FROM events e
         LEFT JOIN users u ON u.id = e.created_by
         ORDER BY e.title`,
      )
      .all() as EventWithCreator[]
  ).map(mapCreatorRow);
}

export function attachCreator(
  event: EventRow,
): EventWithCreator {
  if (!event.created_by) {
    return {
      ...event,
      created_by_name: null,
      created_by_email: null,
    };
  }
  const db = getDb();
  const user = db
    .prepare(`SELECT name, email FROM users WHERE id = ?`)
    .get(event.created_by) as { name: string; email: string } | undefined;
  return {
    ...event,
    created_by_name: user?.name ?? null,
    created_by_email: user?.email ?? null,
  };
}

export function deleteEventBySlug(slug: string): boolean {
  const db = getDb();
  const event = getEventBySlug(slug);
  if (!event) return false;

  db.prepare(`DELETE FROM quirk_reports WHERE event_slug = ?`).run(slug);
  db.prepare(`DELETE FROM events WHERE id = ?`).run(event.id);
  return true;
}

// --- Membership ---

export function getUserEvents(userId: string): EventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.id, e.slug, e.title, e.description, e.created_at, e.starts_at, e.ends_at, e.department, e.created_by
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

// --- Notebooks & redirects ---

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
  role?: string,
): boolean {
  if (role && isStaffPortalRole(role)) {
    if (!eventSlug) return true;
    return (
      Boolean(getEventBySlug(eventSlug)) &&
      isNotebookInEvent(notebookId, eventSlug)
    );
  }
  if (!eventSlug) return false;
  if (!isNotebookInEvent(notebookId, eventSlug)) return false;
  if (!userId || userId === "anonymous") return false;
  return isUserEventMember(userId, eventSlug);
}

/** After email sign-in — always land on the projects picker. */
export function loginRedirectForUser(
  _userId: string,
  _role: string,
): string {
  return "/events";
}
