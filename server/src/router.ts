import type { IncomingMessage, ServerResponse } from "node:http";
import { applyCors } from "./cors.ts";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: any;
  userId?: number;
  role?: string;
}

export type Handler = (ctx: Ctx) => Promise<void> | void;

interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler; }

// Tiny Express-style router: supports "/api/jobs/:id" style patterns with
// no external dependency (this environment can't npm install Express).
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" + path.replace(/:[a-zA-Z]+/g, (m) => { keys.push(m.slice(1)); return "([^/]+)"; }) + "/?$"
    );
    this.routes.push({ method, pattern, keys, handler });
  }
  get(path: string, handler: Handler) { this.add("GET", path, handler); }
  post(path: string, handler: Handler) { this.add("POST", path, handler); }
  put(path: string, handler: Handler) { this.add("PUT", path, handler); }
  delete(path: string, handler: Handler) { this.add("DELETE", path, handler); }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    applyCors(req, res);
    const url = new URL(req.url ?? "/", "http://localhost");
    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const match = route.pattern.exec(url.pathname);
      if (!match) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]); });
      const body = await readJsonBody(req);
      const ctx: Ctx = { req, res, params, query: url.searchParams, body };
      try {
        await route.handler(ctx);
      } catch (err: any) {
        if (!res.headersSent) {
          const status = typeof err?.status === "number" ? err.status : 500;
          sendJson(res, status, { error: err?.message ?? "Internal server error" });
        }
      }
      return true;
    }
    return false;
  }
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "DELETE") return resolve(undefined);
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 10_000_000) req.destroy(); });
    req.on("end", () => {
      if (!data) return resolve(undefined);
      try { resolve(JSON.parse(data)); } catch { resolve(undefined); }
    });
    req.on("error", () => resolve(undefined));
  });
}

export function sendJson(res: ServerResponse, status: number, payload: any) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}
