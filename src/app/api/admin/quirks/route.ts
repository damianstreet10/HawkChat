import { NextResponse } from "next/server";
import { authErrorResponse, requireMonitor } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  isQuirkCategoryFilter,
  type QuirkCategoryFilter,
} from "@/lib/quirk-category";
import { isQuirkEmailConfigured } from "@/lib/quirk-email";
import { isQuirkNotifyConfigured } from "@/lib/quirk-notify";
import { listQuirkReports } from "@/lib/quirk-query";
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
    lanOnly: true,
  });

  return NextResponse.json({
    reports,
    smtpConfigured: isQuirkEmailConfigured(),
    notifyConfigured: isQuirkNotifyConfigured(),
  });
}
