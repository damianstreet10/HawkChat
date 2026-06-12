/** Subtitle under a notebook title on the home page. */
export function notebookCardDescription(
  notebookId: string,
  documents: string[],
  sourceCount: number,
  manifestDescription?: string,
): string {
  if (notebookId === "kit-quirks" || notebookId.endsWith("-kit-quirks")) {
    return "Submit kit & PC quirks for admin review";
  }

  if (documents.length > 0) {
    return `Includes: ${documents.join(", ")}`;
  }

  if (manifestDescription?.trim()) {
    return manifestDescription.trim();
  }

  if (sourceCount > 0) {
    return `${sourceCount} document${sourceCount === 1 ? "" : "s"} ready`;
  }

  return "No documents indexed yet — add PDFs to the seed folder";
}
