/**
 * Lightweight email normalize/validate helpers for auth and member invites.
 * Look here when sign-in or invite rejects an address that looks valid.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Basic shape check after normalize (not full RFC validation). */
export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
