export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_KEY = "hc_token";
const USER_KEY = "hc_user";

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string | null) { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); }
export function getStoredUser<T>(): T | null {
  try { const raw = localStorage.getItem(USER_KEY); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
export function setStoredUser(user: unknown | null) { user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY); }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers as Record<string, string> | undefined)
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) throw new ApiError((data && data.error) || `Request failed (${res.status})`, res.status);
  return data as T;
}
