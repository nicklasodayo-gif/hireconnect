import type { IncomingMessage, ServerResponse } from "node:http";

// Reads a comma-separated allowlist from ALLOWED_ORIGINS (e.g.
// "https://hireconnect.co.ke,https://app.hireconnect.co.ke"). If unset:
//  - in production, no CORS header is sent at all (same-origin only —
//    the safe default the brief asks for instead of "*").
//  - outside production, the requesting origin is reflected back so local
//    development (e.g. opening web/index.html directly, or a Vite dev
//    server on a random port) keeps working without extra setup. This is
//    intentionally different from "*" — it's still origin-specific, just
//    permissive by default in dev.
const configured = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
let warnedDevFallback = false;

export function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");

  if (configured.length > 0) {
    if (origin && configured.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    return;
  }
  if (process.env.NODE_ENV === "production") {
    // No ALLOWED_ORIGINS configured in production: fail closed. Set the
    // env var rather than relying on this fallback.
    return;
  }
  if (origin) {
    if (!warnedDevFallback) {
      console.warn("[cors] ALLOWED_ORIGINS not set — reflecting request origin in non-production mode. Set ALLOWED_ORIGINS before deploying.");
      warnedDevFallback = true;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
}
