import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventAdminError, requireEventMonitor } from "@/lib/event-admin-api";
import { quirkCategoryStats } from "@/lib/quirk-query";
import { isWorldCupEvent } from "@/lib/world-cup-event";

type Params = { params: { slug: string } };

export async function GET(request: Request, { params }: Params) {
  try {
    requireEventMonitor(request, params.slug);
  } catch (err) {
    const res = eventAdminError(err);
    if (res) return res;
    throw err;
  }

  const db = getDb();
  return NextResponse.json(
    quirkCategoryStats(
      db,
      isWorldCupEvent(params.slug)
        ? { lanOnly: true }
        : { eventSlug: params.slug },
    ),
  );
}
