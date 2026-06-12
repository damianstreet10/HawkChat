export const EVENT_CONTEXT_COOKIE = "hawkchat_event";

export function eventCookieOptions(slug: string) {
  const maxAge = 60 * 60 * 24 * 30;
  return {
    name: EVENT_CONTEXT_COOKIE,
    value: slug,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function clearEventCookieOptions() {
  return {
    name: EVENT_CONTEXT_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function readEventSlugFromCookie(
  cookieHeader: string | null,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp(`${EVENT_CONTEXT_COOKIE}=([^;]+)`),
  );
  const value = match?.[1]?.trim();
  return value || undefined;
}
