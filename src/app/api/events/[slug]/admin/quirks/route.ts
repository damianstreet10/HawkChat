import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventAdminError, requireEventMonitor } from "@/lib/event-admin-api";
import {
  isQuirkCategoryFilter,
  type QuirkCategoryFilter,
} from "@/lib/quirk-category";
import { isQuirkEmailConfigured } from "@/lib/quirk-email";
import { isQuirkNotifyConfigured } from "@/lib/quirk-notify";
import { listQuirkReports } from "@/lib/quirk-query";
import { isQuirkStatusFilter, type QuirkStatusFilter } from "@/lib/quirk-status";
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

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(1, Number(url.searchParams.get("limit") ?? 200)),
  );
  const statusParam = url.searchParams.get("status") ?? "all";
  const categoryParam = url.searchParams.get("category") ?? "all";
  const q = url.searchParams.get("q") ?? "";

  const statusFilter: QuirkStatusFilter = isQuirkStatusFilter(statusParam)
    ? statusParam
    : "all";
  const categoryFilter: QuirkCategoryFilter = isQuirkCategoryFilter(
    categoryParam,
  )
    ? categoryParam
    : "all";

  const db = getDb();
  const reports = listQuirkReports(db, {
    status: statusFilter,
    category: categoryFilter,
    q,
    limit,
    ...(isWorldCupEvent(params.slug)
      ? { lanOnly: true }
      : { eventSlug: params.slug }),
  });

  return NextResponse.json({
    reports,
    smtpConfigured: isQuirkEmailConfigured(),
    notifyConfigured: isQuirkNotifyConfigured(),
  });
}
