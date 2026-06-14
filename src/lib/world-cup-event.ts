import { readEventManifest } from "./event-manifest";
import { readSeedManifest, type SeedNotebook } from "./seed-manifest";
import { isWorldCupEvent, WORLD_CUP_EVENT_SLUG } from "./world-cup-constants";

export { isWorldCupEvent, WORLD_CUP_EVENT_SLUG };

/** Notebooks for the World Cup event mirror the main LAN seed manifest. */
export function getWorldCupNotebooks(): SeedNotebook[] {
  return readSeedManifest() ?? [];
}

export function getEventManifestNotebooks(slug: string): SeedNotebook[] {
  if (isWorldCupEvent(slug)) {
    return getWorldCupNotebooks();
  }
  return readEventManifest(slug)?.notebooks ?? [];
}

export function sortEventsForPicker<
  T extends { slug: string; title: string },
>(events: T[]): T[] {
  const priority = [
    WORLD_CUP_EVENT_SLUG,
    "champions-league",
    "test-event-1",
    "test-event-2",
  ];
  return [...events].sort((a, b) => {
    const ai = priority.indexOf(a.slug);
    const bi = priority.indexOf(b.slug);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
    return a.title.localeCompare(b.title);
  });
}
