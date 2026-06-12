import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listEventExchanges } from "@/lib/event-activity";
import { eventAdminError, requireEventMonitor } from "@/lib/event-admin-api";

type Params = { params: { slug: string } };

export async function GET(request: Request, { params }: Params) {
  try {
    requireEventMonitor(request, params.slug);
  } catch (err) {
    const res = eventAdminError(err);
    if (res) return res;
    throw err;
  }

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
  );

  const db = getDb();
  const exchanges = listEventExchanges(db, limit, {
    eventSlug: params.slug,
  });

  return NextResponse.json({ exchanges });
}
