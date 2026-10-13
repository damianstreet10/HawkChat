/**
 * POST /api/admin/events/[slug]/notebooks — add a custom notebook to an event.
 * Callers: event admin "add notebook". Debug requireEventEditor, WC block,
 * or addCustomNotebookToEvent / manifest write failures.
 */
import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth";
import { requireEventEditor } from "@/lib/event-ownership";
import {
  addCustomNotebookToEvent,
  parseCustomNotebooks,
} from "@/lib/event-provision";
import { isWorldCupEvent } from "@/lib/world-cup-constants";

type Params = { params: { slug: string } };

/** Event editor: append one custom notebook (then manage files separately). */
export async function POST(request: Request, { params }: Params) {
  try {
    requireEventEditor(request, params.slug);
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }

  if (isWorldCupEvent(params.slug)) {
    return NextResponse.json(
      { error: "Cannot add custom notebooks to the World Cup event this way." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const customs = parseCustomNotebooks(
    body.notebook
      ? [body.notebook]
      : body.customNotebooks ?? [{ title: body.title, description: body.description }],
  );
  const custom = customs[0];
  if (!custom) {
    return NextResponse.json(
      { error: "Notebook title is required." },
      { status: 400 },
    );
  }

  try {
    const notebook = addCustomNotebookToEvent(params.slug, custom);
    return NextResponse.json({ ok: true, notebook });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Could not add custom notebook.",
      },
      { status: 500 },
    );
  }
}
