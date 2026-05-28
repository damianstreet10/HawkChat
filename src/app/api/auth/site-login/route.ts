import { NextResponse } from "next/server";
import {
  guestLabelCookieOptions,
  isSiteGateEnabled,
  siteAccessCookieOptions,
  siteAccessToken,
} from "@/lib/site-gate";

export async function POST(request: Request) {
  if (!isSiteGateEnabled()) {
    return NextResponse.json(
      { error: "Site password is not configured" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const password =
    typeof body.password === "string" ? body.password : "";
  const displayName =
    typeof body.displayName === "string"
      ? body.displayName.trim().slice(0, 80)
      : "";

  if (!displayName) {
    return NextResponse.json(
      { error: "Your name is required" },
      { status: 400 },
    );
  }

  const expected = process.env.HAWKCHAT_SITE_PASSWORD!.trim();
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(siteAccessCookieOptions(siteAccessToken(expected)));
  res.cookies.set(guestLabelCookieOptions(displayName));
  return res;
}
