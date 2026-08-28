export function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isNonEmptyString(v: unknown, maxLen = 5000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= maxLen;
}

export function isStrongPassword(v: unknown): v is string {
  return typeof v === "string" && v.length >= 8;
}

export function isOneOf<T extends string>(v: unknown, options: readonly T[]): v is T {
  return typeof v === "string" && (options as readonly string[]).includes(v);
}

export function toInt(v: unknown, fallback: number | null = null): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) { super(message); }
}
