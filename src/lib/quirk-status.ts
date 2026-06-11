export const QUIRK_STATUSES = ["new", "in_progress", "resolved"] as const;
export type QuirkStatus = (typeof QUIRK_STATUSES)[number];

export type QuirkStatusFilter = QuirkStatus | "all";

export const QUIRK_STATUS_LABELS: Record<QuirkStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const QUIRK_FILTER_TABS: Array<{ id: QuirkStatusFilter; label: string }> =
  [
    { id: "new", label: "New" },
    { id: "in_progress", label: "In progress" },
    { id: "resolved", label: "Resolved" },
    { id: "all", label: "All" },
  ];

export function isQuirkStatus(value: string): value is QuirkStatus {
  return (QUIRK_STATUSES as readonly string[]).includes(value);
}

export function isQuirkStatusFilter(value: string): value is QuirkStatusFilter {
  return value === "all" || isQuirkStatus(value);
}
