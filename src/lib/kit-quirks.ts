export const KIT_QUIRKS_NOTEBOOK_ID = "kit-quirks";

export function isKitQuirksNotebook(notebookId: string): boolean {
  return (
    notebookId === KIT_QUIRKS_NOTEBOOK_ID || notebookId.endsWith("-kit-quirks")
  );
}
