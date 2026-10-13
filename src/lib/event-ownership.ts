/**
 * Event edit rights: creator admin or super admin (env-configured owners).
 * Look here when an admin gets 403 editing an event they didn't create.
 */
import type { AuthUser } from "./auth";
import { AuthError, requireAdmin } from "./auth";
import { getEventBySlug, type EventRow } from "./events";
import { isSuperAdmin } from "./super-admin";

/** True if super admin, or the user id matches event.created_by. */
export function canEditEvent(
  user: Pick<AuthUser, "id" | "email" | "role">,
  event: Pick<EventRow, "created_by">,
): boolean {
  if (isSuperAdmin(user)) return true;
  if (!event.created_by) return false;
  return event.created_by === user.id;
}

/** Admin who may change this event (creator or super admin). */
export function requireEventEditor(
  request: Request,
  slug: string,
): { user: AuthUser; event: EventRow } {
  const user = requireAdmin(request);
  const event = getEventBySlug(slug);
  if (!event) {
    throw new AuthError("Event not found", 404);
  }
  if (!canEditEvent(user, event)) {
    throw new AuthError(
      "Only the admin who created this event (or a super admin) can edit it.",
      403,
    );
  }
  return { user, event };
}
