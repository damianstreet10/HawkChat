import { NextResponse } from "next/server";
import { buildLanUrl, isValidLanUrl } from "@/lib/lan-url";

export async function GET() {
  const fromEnv = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_URL?.trim() ?? "";
  const port = Number(process.env.PORT ?? 3000);

  const url =
    fromEnv && isValidLanUrl(fromEnv)
      ? fromEnv
      : buildLanUrl(port) ?? fromEnv;

  return NextResponse.json({ url: url || null });
}
