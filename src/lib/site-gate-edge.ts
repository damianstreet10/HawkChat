/** Edge-safe site gate check for middleware (matches site-gate.ts HMAC). */
export const SITE_ACCESS_COOKIE = "hawkchat_site";

export async function siteAccessTokenEdge(password: string): Promise<string> {
  const secret =
    process.env.HAWKCHAT_SITE_COOKIE_SECRET?.trim() ||
    password ||
    "hawkchat-site-gate";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(password),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSiteAccessCookieEdge(
  cookieValue: string | undefined,
): Promise<boolean> {
  const password = process.env.HAWKCHAT_SITE_PASSWORD?.trim();
  if (!password || !cookieValue) return false;
  const expected = await siteAccessTokenEdge(password);
  return cookieValue === expected;
}

export function isSiteGateEnabledEdge(): boolean {
  return Boolean(process.env.HAWKCHAT_SITE_PASSWORD?.trim());
}
