import type { AuthUser } from "./auth";
import {
  getEventBySlug,
  getUserEvents,
  isUserEventMember,
  listEvents,
} from "./events";

export function canAccessEvent(user: AuthUser, eventSlug: string): boolean {
  if (user.role === "admin" || user.role === "monitor") {
    return Boolean(getEventBySlug(eventSlug));
  }
  return isUserEventMember(user.id, eventSlug);
}

export function listAccessibleEvents(user: AuthUser) {
  if (user.role === "admin" || user.role === "monitor") {
    return listEvents();
  }
  return getUserEvents(user.id);
}
