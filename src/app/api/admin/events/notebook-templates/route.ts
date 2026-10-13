/**
 * GET /api/admin/events/notebook-templates — list notebook templates for event create.
 * Callers: admin create-event picker. Debug requireAdmin or empty template list
 * from listNotebookTemplates / labels map.
 */
import { NextResponse } from "next/server";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { listNotebookTemplates } from "@/lib/event-provision";
import { NOTEBOOK_TEMPLATE_LABELS } from "@/lib/notebook-templates";

/** Admin: templates available when provisioning a new event. */
export async function GET(request: Request) {
  try {
    requireAdmin(request);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  const templates = listNotebookTemplates().map((template) => ({
    ...template,
    pickerLabel: NOTEBOOK_TEMPLATE_LABELS[template.id],
  }));

  return NextResponse.json({ templates });
}
