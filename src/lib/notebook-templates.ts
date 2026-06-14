/** Template notebook IDs from seed/manifest.json — shared LAN document folders. */
export const NOTEBOOK_TEMPLATE_IDS = [
  "useful-resources",
  "hardware-support",
  "software-support",
  "kit-quirks",
] as const;

export type NotebookTemplateId = (typeof NOTEBOOK_TEMPLATE_IDS)[number];

/** Admin-facing labels (useful-resources shown as Important Information). */
export const NOTEBOOK_TEMPLATE_LABELS: Record<NotebookTemplateId, string> = {
  "useful-resources": "Important Information",
  "hardware-support": "Hardware Support",
  "software-support": "Software Support",
  "kit-quirks": "Kit Quirks",
};

export function isNotebookTemplateId(value: string): value is NotebookTemplateId {
  return (NOTEBOOK_TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Kit Quirks is a report form — not a document notebook. */
export function notebookTemplateHasSeedFiles(
  templateId: NotebookTemplateId,
): boolean {
  return templateId !== "kit-quirks";
}
