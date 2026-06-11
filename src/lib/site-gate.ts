import { createHmac, timingSafeEqual } from "crypto";

export const SITE_ACCESS_COOKIE = "hawkchat_site";

export function isSiteGateEnabled(): boolean {
  return Boolean(process.env.HAWKCHAT_SITE_PASSWORD?.trim());
}

export function siteAccessToken(password: string): string {
  const secret =
    process.env.HAWKCHAT_SITE_COOKIE_SECRET?.trim() ||
    process.env.HAWKCHAT_SITE_PASSWORD?.trim() ||
    "hawkchat-site-gate";
  return createHmac("sha256", secret).update(password).digest("hex");
}

export function isValidSiteAccessCookie(
  cookieValue: string | undefined,
): boolean {
  const password = process.env.HAWKCHAT_SITE_PASSWORD?.trim();
  if (!password || !cookieValue) return false;
  const expected = siteAccessToken(password);
  try {
    const a = Buffer.from(cookieValue, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function siteAccessCookieOptions(token: string) {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return {
    name: SITE_ACCESS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Grant site access (e.g. after staff login) without typing the site password. */
export function grantSiteAccessCookieOptions() {
  const password = process.env.HAWKCHAT_SITE_PASSWORD?.trim();
  if (!password) {
    return clearSiteAccessCookieOptions();
  }
  return siteAccessCookieOptions(siteAccessToken(password));
}

export function clearSiteAccessCookieOptions() {
  return {
    name: SITE_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export const GUEST_LABEL_COOKIE = "hawkchat_guest_label";

export function guestLabelCookieOptions(label: string) {
  const maxAge = 60 * 60 * 24 * 30;
  return {
    name: GUEST_LABEL_COOKIE,
    value: encodeURIComponent(label.slice(0, 80)),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function clearGuestLabelCookieOptions() {
  return {
    name: GUEST_LABEL_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function readGuestLabelFromCookie(
  cookieHeader: string | null,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(
    new RegExp(`${GUEST_LABEL_COOKIE}=([^;]+)`),
  );
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]).trim() || undefined;
  } catch {
    return undefined;
  }
}
