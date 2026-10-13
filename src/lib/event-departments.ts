/**
 * Allowed event department slugs, labels, and badge styles for admin UI filters.
 * Look here when a department won't save/parse or badge colors look wrong.
 */
export const EVENT_DEPARTMENTS = [
  "football-events",
  "uk-football",
  "cricket",
  "rugby",
  "tennis",
] as const;

export type EventDepartment = (typeof EVENT_DEPARTMENTS)[number];

export const EVENT_DEPARTMENT_LABELS: Record<EventDepartment, string> = {
  "football-events": "Football Events",
  "uk-football": "UK Football",
  cricket: "Cricket",
  rugby: "Rugby",
  tennis: "Tennis",
};

/** Tailwind-friendly badge styles per department. */
export const EVENT_DEPARTMENT_STYLES: Record<EventDepartment, string> = {
  "football-events": "border-sky-400/40 bg-sky-500/15 text-sky-200",
  "uk-football": "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  cricket: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  rugby: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  tennis: "border-lime-400/40 bg-lime-500/15 text-lime-200",
};

export function isEventDepartment(value: string): value is EventDepartment {
  return (EVENT_DEPARTMENTS as readonly string[]).includes(value);
}

export function parseEventDepartment(value: unknown): EventDepartment | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return isEventDepartment(trimmed) ? trimmed : null;
}

export function departmentLabel(department: string | null | undefined): string {
  if (!department || !isEventDepartment(department)) return "Unassigned";
  return EVENT_DEPARTMENT_LABELS[department];
}

export function departmentStyle(department: string | null | undefined): string {
  if (!department || !isEventDepartment(department)) {
    return "border-hawk-600 bg-hawk-800/60 text-hawk-300";
  }
  return EVENT_DEPARTMENT_STYLES[department];
}
