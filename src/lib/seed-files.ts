import fs from "fs";
import path from "path";

export const SEED_DOC_EXTENSIONS = new Set(["pdf", "txt", "md", "markdown"]);

const SEED_ROOT = path.join(process.cwd(), "seed");

export function isSeedDocumentName(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.startsWith(".") || lower.includes("readme")) return false;
  return SEED_DOC_EXTENSIONS.has(filename.split(".").pop()?.toLowerCase() ?? "");
}

export function sanitizeSeedFilename(name: string): string {
  const base = path.basename(name.trim());
  if (!base || base.includes("..") || base !== name.trim().replace(/\\/g, "/").split("/").pop()) {
    throw new Error("Invalid filename.");
  }
  if (!isSeedDocumentName(base)) {
    throw new Error("Unsupported file type. Use PDF, TXT, or Markdown.");
  }
  return base;
}

/** Relative path under seed/, e.g. software-support or events/my-event/software-support */
export function resolveSeedDir(relativeDir: string): string {
  const normalized = relativeDir.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid seed path.");
  }
  const resolved = path.resolve(SEED_ROOT, normalized);
  if (resolved !== SEED_ROOT && !resolved.startsWith(`${SEED_ROOT}${path.sep}`)) {
    throw new Error("Invalid seed path.");
  }
  return resolved;
}

export function listFilesInSeedDir(relativeDir: string): string[] {
  const dir = resolveSeedDir(relativeDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter(isSeedDocumentName)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function writeSeedFile(
  relativeDir: string,
  filename: string,
  buffer: Buffer,
): string {
  const safeName = sanitizeSeedFilename(filename);
  const dir = resolveSeedDir(relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safeName), buffer);
  return safeName;
}

export function deleteSeedFile(relativeDir: string, filename: string): void {
  const safeName = sanitizeSeedFilename(filename);
  const filePath = path.join(resolveSeedDir(relativeDir), safeName);
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found.");
  }
  fs.unlinkSync(filePath);
}

export function seedRelativePath(relativeDir: string): string {
  return `seed/${relativeDir.replace(/\\/g, "/").replace(/\/$/, "")}/`;
}

export function mimeForSeedFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "pdf" ? "application/pdf" : "text/plain";
}
