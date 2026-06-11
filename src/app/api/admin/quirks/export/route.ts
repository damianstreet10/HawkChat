import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  isQuirkCategoryFilter,
  type QuirkCategoryFilter,
} from "@/lib/quirk-category";
import {
  listQuirkReportsForExport,
  quirkReportsToCsv,
} from "@/lib/quirk-query";
import { isQuirkStatusFilter, type QuirkStatusFilter } from "@/lib/quirk-status";

export async function GET(request: Request) {
  try {
    requireMonitor(request);
  } catch (err) {
    const res = authErrorResponse(err);
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
  });

  const csv = quirkReportsToCsv(reports as Array<Record<string, unknown>>);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kit-quirks-${stamp}.csv"`,
    },
  });
}
