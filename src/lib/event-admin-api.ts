import { AuthError, authErrorResponse, requireMonitor } from "./auth";
import { canAccessEvent } from "./event-access";

export function requireEventMonitor(request: Request, eventSlug: string) {
  const user = requireMonitor(request);
  if (!canAccessEvent(user, eventSlug)) {
    throw new AuthError("Not allowed for this event", 403);
  }
  return user;
}

export function eventAdminError(err: unknown) {
  return authErrorResponse(err);
}
