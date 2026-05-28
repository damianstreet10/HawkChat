import { NextResponse } from "next/server";
import { isSiteGateEnabled } from "@/lib/site-gate";

export async function GET() {
  return NextResponse.json({ siteGate: isSiteGateEnabled() });
}
