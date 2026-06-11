import { randomBytes } from "crypto";

export const CLIENT_SESSION_COOKIE = "hawkchat_guest";
const CLIENT_SESSION_DAYS = 90;

export function generateClientSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function getClientSessionIdFromRequest(
  request: Request,
): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp(`${CLIENT_SESSION_COOKIE}=([^;]+)`),
  );
  return match?.[1];
}

/** Client IP for audit logs (LAN / reverse proxy). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function clientSessionCookieOptions(sessionId: string) {
  const maxAge = CLIENT_SESSION_DAYS * 24 * 60 * 60;
  return {
    name: CLIENT_SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function clearClientSessionCookieOptions() {
  return {
    name: CLIENT_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
