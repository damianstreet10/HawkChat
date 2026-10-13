/**
 * Notebooks listed on home but not yet openable (coming-soon gate).
 * Look here when a notebook appears disabled or won't open despite existing.
 */
/** Notebooks shown on the home page but not yet openable. */
export const DISABLED_NOTEBOOK_IDS = new Set(["hardware-support"]);

export function isNotebookDisabled(notebookId: string): boolean {
  return DISABLED_NOTEBOOK_IDS.has(notebookId);
}
