import { NextResponse } from "next/server";
import { clearSiteAccessCookieOptions } from "@/lib/site-gate";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSiteAccessCookieOptions());
  res.cookies.set({
    name: "hawkchat_guest_label",
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
