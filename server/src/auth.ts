import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing uses Node's built-in scrypt (no external bcrypt dependency
// required — this keeps the backend runnable with zero npm installs while
// still using a memory-hard, industry-accepted KDF). Format: scrypt$salt$hash
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
