/**
 * Detect the Kit Quirks special notebook (base id or event-suffixed *-kit-quirks).
 * Look here when the quirks form vs document chat UI is shown for the wrong notebook.
 */
export const KIT_QUIRKS_NOTEBOOK_ID = "kit-quirks";

/** True for LAN kit-quirks or per-event `{slug}-kit-quirks` notebooks. */
export function isKitQuirksNotebook(notebookId: string): boolean {
  return (
    notebookId === KIT_QUIRKS_NOTEBOOK_ID || notebookId.endsWith("-kit-quirks")
  );
}
