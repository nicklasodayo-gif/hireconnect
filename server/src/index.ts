import http from "node:http";
import { openDb } from "./db.ts";
import { buildApp } from "./app.ts";
import { sendJson } from "./router.ts";
import { applyCors } from "./cors.ts";

const PORT = Number(process.env.PORT ?? 4000);
const DB_PATH = process.env.DB_PATH ?? "./hireconnect.db";

const db = openDb(DB_PATH);
const router = buildApp(db);

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    applyCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }
  const handled = await router.dispatch(req, res);
  if (!handled) sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HireConnect API listening on port ${PORT} (db: ${DB_PATH})`);
});

// Graceful shutdown so container/process-manager restarts don't drop
// in-flight requests abruptly.
function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { server, db };
