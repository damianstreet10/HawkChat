import pdf from "pdf-parse";

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || ext === "pdf") {
    const data = await pdf(buffer);
    return data.text;
  }

  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "markdown", "csv", "json", "html", "htm"].includes(ext)
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type: ${mimeType || ext}. Upload PDF or text/markdown files.`,
  );
}
