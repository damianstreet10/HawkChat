/**
 * Canonical World Cup event slug used for the live LAN demo mapping.
 * Look here when guest feedback or staff views don't attach to world-cup-2026.
 */
/** Live LAN demo — guest feedback at / maps to this staff event. */
export const WORLD_CUP_EVENT_SLUG = "world-cup-2026";

export function isWorldCupEvent(slug: string): boolean {
  return slug === WORLD_CUP_EVENT_SLUG;
}
