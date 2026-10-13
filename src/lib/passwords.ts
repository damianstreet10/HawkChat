/**
 * Password hashing (scrypt) for account login.
 * Look here for login failures, weak-password rejections, or hash format mismatches.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const MIN_PASSWORD_LENGTH = 8;

/** Stored format: `scrypt:<saltHex>:<hashHex>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, 64);
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): string | null {
  if (typeof password !== "string" || !password) {
    return "Password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export { MIN_PASSWORD_LENGTH };
