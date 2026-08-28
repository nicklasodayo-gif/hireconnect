# HireConnect Deployment

## What's provided vs. what needs your own registry access

Everything below is written and ready; the one thing I can't do from this
sandbox is actually run `docker build`/`npm install`/deploy to a live
service, since this environment has no network access to Docker Hub, the
npm registry, or any hosting provider's API. Treat the Dockerfile and
instructions as reviewed-and-ready, and verify the build once on a machine
with normal internet access.

## Backend (Render / Railway / Fly.io / VPS)

### Option A — Docker (recommended, works identically across all four)
```bash
docker build -t hireconnect-api .
docker run -p 4000:4000 -v hireconnect_data:/data \
  -e ALLOWED_ORIGINS=https://your-frontend-domain.com \
  hireconnect-api
```
Or `docker compose up -d` using the provided `docker-compose.yml`.

- **Render**: "New Web Service" → point at this repo → it detects the
  `Dockerfile` automatically. Add a persistent disk mounted at `/data`
  (SQLite needs real disk, not ephemeral storage) and set
  `DB_PATH=/data/hireconnect.db`.
- **Railway**: "New Project" → "Deploy from repo" → it detects the
  Dockerfile. Attach a volume at `/data`.
- **Fly.io**: `fly launch` (detects the Dockerfile), then `fly volumes
  create hireconnect_data --size 1` and mount it at `/data` in `fly.toml`.
- **VPS**: `docker compose up -d` directly on the box, put a reverse proxy
  (Caddy/nginx) in front for TLS.

### Option B — bare Node (no Docker)
```bash
cd server
npm run seed   # first time only
NODE_ENV=production PORT=4000 ALLOWED_ORIGINS=https://your-frontend-domain.com \
  node --experimental-strip-types --experimental-sqlite src/index.ts
```
Run under a process manager (pm2 or a systemd unit) so it restarts on
crash/reboot. The app already handles `SIGTERM`/`SIGINT` gracefully.

### Environment variables (see `server/.env.example`)
`PORT`, `DB_PATH`, `NODE_ENV=production`, `ALLOWED_ORIGINS`
(comma-separated frontend origins — **required** in production, since
CORS fails closed without it), `SEED_DEFAULT_PASSWORD`/
`SEED_ADMIN_PASSWORD` (only relevant if you run the seed script somewhere
real, which you normally wouldn't).

## Database

Currently SQLite (a single file at `DB_PATH`, needs persistent storage —
see the disk/volume notes above). To move to Postgres, see
`database/postgres/README.md` for the exact steps; once done, swap the
hosting to a managed Postgres instance (Render Postgres, Railway Postgres,
Fly Postgres, Supabase, Neon, etc.) and set `DATABASE_URL`.

## Frontend

### `web-vite/` (recommended — real build)
```bash
cd web-vite
npm install
npm run build        # outputs to web-vite/dist
```
Deploy `dist/` to **Vercel** or **Netlify** as a static site. Set
`VITE_API_BASE_URL` to your deployed backend's URL as a build-time
environment variable on whichever platform you use.

### `web/` (CDN/Babel version — zero build step)
Can be served as-is from any static host (or even opened as a local file)
since it has no build step. Change `window.API_BASE` in `web/config.js`
before deploying. This is the fallback described in `UPGRADE_PLAN.md`
Checkpoint B — prefer `web-vite/` for anything beyond a quick demo.

## Health check

`GET /api/health` → `{ status: "ok", db: "connected" }`. Wired into the
Dockerfile's `HEALTHCHECK` and the provided `docker-compose.yml`; point
your hosting provider's health-check config at this path if it asks for one.

## Post-deploy checklist

1. `ALLOWED_ORIGINS` set to your real frontend domain(s) — not left empty
   in production (CORS will silently block everything if you forget this).
2. `NODE_ENV=production` set (gates dev-only token fields, per
   `docs/SECURITY.md`).
3. Persistent volume mounted for the SQLite file (or migrated to Postgres).
4. `web-vite`'s `VITE_API_BASE_URL` points at the deployed API, not
   `localhost`.
5. Run `npm test` in `server/` once against your deployed config
   (pointing `DB_PATH` at a throwaway test file) before declaring it live.
