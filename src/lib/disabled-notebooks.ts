/** Notebooks shown on the home page but not yet openable. */
export const DISABLED_NOTEBOOK_IDS = new Set(["hardware-support"]);

export function isNotebookDisabled(notebookId: string): boolean {
  return DISABLED_NOTEBOOK_IDS.has(notebookId);
}
