import fs from "fs";
import path from "path";
import type { SeedNotebook } from "./seed-manifest";

export type EventManifest = {
  eventTitle: string;
  eventDescription?: string;
  notebooks: SeedNotebook[];
};

export function eventSeedRoot(slug: string): string {
  return path.join(process.cwd(), "seed", "events", slug);
}

export function eventManifestPath(slug: string): string {
  return path.join(eventSeedRoot(slug), "manifest.json");
}

export function readEventManifest(slug: string): EventManifest | null {
  const manifestPath = eventManifestPath(slug);
  if (!fs.existsSync(manifestPath)) return null;

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as EventManifest;
  if (!raw.eventTitle || !Array.isArray(raw.notebooks)) return null;
  return raw;
}

export function listEventSlugsFromDisk(): string[] {
  const root = path.join(process.cwd(), "seed", "events");
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(eventManifestPath(slug)))
    .sort();
}
