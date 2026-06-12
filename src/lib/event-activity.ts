import type Database from "better-sqlite3";
import { getEventNotebookIds } from "./events";
import { getLanDemoNotebookIds } from "./lan-demo-scope";
import { isWorldCupEvent } from "./world-cup-event";

export function listEventExchanges(
  db: Database.Database,
  limit: number,
  scope: { eventSlug?: string; lanOnly?: boolean },
) {
  const notebookIds = scope.eventSlug
    ? isWorldCupEvent(scope.eventSlug)
      ? getLanDemoNotebookIds()
      : getEventNotebookIds(scope.eventSlug)
    : scope.lanOnly
      ? getLanDemoNotebookIds()
      : null;

  if (notebookIds && notebookIds.length === 0) {
    return [];
  }

  const notebookFilter = notebookIds
    ? `AND a.notebook_id IN (${notebookIds.map(() => "?").join(", ")})`
    : "";

  const bindings: unknown[] = notebookIds ? [...notebookIds, limit] : [limit];

  return db
    .prepare(
      `SELECT
         u.id AS question_id,
         u.notebook_id,
         u.content AS question,
         u.client_ip,
         u.client_session_id,
         u.guest_label,
         u.created_at AS asked_at,
         a.id AS answer_id,
         a.content AS answer,
         a.feedback,
         a.feedback_at,
         n.title AS notebook_title
       FROM messages a
       JOIN notebooks n ON n.id = a.notebook_id
       JOIN messages u ON u.id = a.user_message_id
       WHERE a.role = 'assistant'
       ${notebookFilter}
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(...bindings);
}
