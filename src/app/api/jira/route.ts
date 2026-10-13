/**
 * GET /api/jira — whether Jira ticket creation is configured.
 * POST /api/jira — create a ticket from chat context under the event Epic + labels.
 * Callers: ChatPanel "Open Jira ticket". Debug missing env, Epic create, or project key.
 */
import { NextResponse } from "next/server";
import {
  authErrorResponse,
  getAuthUserFromRequest,
} from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { getDb } from "@/lib/db";
import {
  createJiraIssue,
  isJiraConfigured,
} from "@/lib/jira";

/** Public-ish status (no secrets) so the UI can show/hide the button. */
export async function GET() {
  return NextResponse.json({
    enabled: isJiraConfigured(),
  });
}

/** Create a Jira issue populated with the chat question/answer context. */
export async function POST(request: Request) {
  try {
    if (!isJiraConfigured()) {
      return NextResponse.json(
        {
          error:
            "Jira is not configured yet. Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to .env.",
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    const answer =
      typeof body.answer === "string" ? body.answer.trim() : "";
    let notebookTitle =
      typeof body.notebookTitle === "string"
        ? body.notebookTitle.trim()
        : "";
    const notebookId =
      typeof body.notebookId === "string" ? body.notebookId.trim() : "";
    const eventSlug =
      typeof body.eventSlug === "string" ? body.eventSlug.trim() : "";
    let eventTitle =
      typeof body.eventTitle === "string" ? body.eventTitle.trim() : "";

    if (!question) {
      return NextResponse.json(
        { error: "A question is required to open a ticket." },
        { status: 400 },
      );
    }

    if (eventSlug && !eventTitle) {
      const event = getEventBySlug(eventSlug);
      if (event?.title) eventTitle = event.title;
    }

    if (notebookId && !notebookTitle) {
      const db = getDb();
      const nb = db
        .prepare(`SELECT title FROM notebooks WHERE id = ?`)
        .get(notebookId) as { title?: string } | undefined;
      if (nb?.title) notebookTitle = nb.title;
    }

    const user = getAuthUserFromRequest(request);
    const reporter =
      user && user.id !== "anonymous"
        ? `${user.name} <${user.email}>`
        : "Guest / unsigned-in user";

    const prefix = eventTitle || eventSlug || "HawkChat";
    const notebookBit = notebookTitle ? ` · ${notebookTitle}` : "";
    const summaryBase = question.replace(/\s+/g, " ").slice(0, 140);
    const summary = `[${prefix}${notebookBit}] ${summaryBase}`.slice(0, 255);

    const description = [
      "Support request from HawkChat (user did not get the answer they needed).",
      "",
      `Reporter: ${reporter}`,
      eventTitle ? `HawkChat project: ${eventTitle}` : null,
      eventSlug ? `HawkChat project slug: ${eventSlug}` : null,
      notebookTitle ? `Notebook: ${notebookTitle}` : null,
      notebookId ? `Notebook ID: ${notebookId}` : null,
      "",
      "Organization:",
      "- Tickets for this HawkChat project are grouped under a Jira Epic with the same name.",
      "- Labels tag the event and notebook (e.g. hardware) for filtering.",
      "",
      "--- Question ---",
      question,
      "",
      "--- Bot answer ---",
      answer || "(no assistant reply)",
      "",
      "--- Notes ---",
      "Created automatically from the HawkChat chat UI.",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const issue = await createJiraIssue({
      summary,
      description,
      eventSlug,
      eventTitle,
      notebookId,
      notebookTitle,
    });

    return NextResponse.json({ ok: true, issue });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not create Jira ticket.",
      },
      { status: 502 },
    );
  }
}
