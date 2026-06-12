import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventAdminError, requireEventMonitor } from "@/lib/event-admin-api";
import {
  isQuirkCategoryFilter,
  type QuirkCategoryFilter,
} from "@/lib/quirk-category";
import {
  listQuirkReportsForExport,
  quirkReportsToCsv,
} from "@/lib/quirk-query";
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
  const reports = listQuirkReportsForExport(db, {
    status: statusFilter,
    category: categoryFilter,
    q,
    ...(isWorldCupEvent(params.slug)
      ? { lanOnly: true }
      : { eventSlug: params.slug }),
  });

  const csv = quirkReportsToCsv(reports as Array<Record<string, unknown>>);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.slug}-kit-quirks-${stamp}.csv"`,
    },
  });
}
