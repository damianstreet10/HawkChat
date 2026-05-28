import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isSiteGateEnabledEdge,
  isValidSiteAccessCookieEdge,
} from "@/lib/site-gate-edge";

const SESSION_COOKIE = "hawkchat_session";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/login" ||
    pathname === "/login/staff" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/site-login" ||
    pathname === "/api/auth/site-logout" ||
    pathname === "/api/auth/site-status" ||
    pathname === "/api/client/session" ||
    pathname === "/api/lan-url"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const monitorRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  const staffSession = request.cookies.get(SESSION_COOKIE)?.value;

  // Site-wide password (public deployment) — staff login bypasses site password
  if (isSiteGateEnabledEdge() && !staffSession) {
    const siteCookie = request.cookies.get("hawkchat_site")?.value;
    const siteOk = await isValidSiteAccessCookieEdge(siteCookie);
    if (!siteOk) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Site password required" },
          { status: 401 },
        );
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Staff-only admin routes
  if (monitorRoute) {
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Sign in required" }, { status: 401 });
      }
      const staffUrl = new URL("/login/staff", request.url);
      staffUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(staffUrl);
    }
    return NextResponse.next();
  }

  const requireAuth = process.env.HAWKCHAT_REQUIRE_AUTH === "true";
  if (!requireAuth) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const loginUrl = new URL("/login/staff", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
