/** Live LAN demo — guest feedback at / maps to this staff event. */
export const WORLD_CUP_EVENT_SLUG = "world-cup-2026";

export function isWorldCupEvent(slug: string): boolean {
  return slug === WORLD_CUP_EVENT_SLUG;
}
