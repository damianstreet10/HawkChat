/**
 * Shared guards/error helpers for per-event admin API routes (activity, quirks).
 * Look here when event admin endpoints return 403 despite staff login.
 */
import { AuthError, authErrorResponse, requireMonitor } from "./auth";
import { canAccessEvent } from "./event-access";

/** Monitor/admin who can access this event (staff + membership/event exists). */
export function requireEventMonitor(request: Request, eventSlug: string) {
  const user = requireMonitor(request);
  if (!canAccessEvent(user, eventSlug)) {
    throw new AuthError("Not allowed for this event", 403);
  }
  return user;
}

/** Map AuthError (and unknowns) to the standard JSON error Response. */
export function eventAdminError(err: unknown) {
  return authErrorResponse(err);
}
