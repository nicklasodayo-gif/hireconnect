Deploying HireConnect to Fly (free tier) and Vercel (frontend)

Overview

This repository includes a Dockerfile for the backend (`Dockerfile`) and a Vite-based frontend under `web-vite`. The recommended free hosting approach with a persistent SQLite is:

- Backend: Fly (use `flyctl`) with a persistent volume for SQLite (free tier available with limits).
- Frontend: Vercel (static site from `web-vite/dist`).

Quick steps

1) Install Fly CLI and login:

```bash
# macOS / Linux (Windows: follow https://fly.io/docs/hands-on/install-flyctl/)
curl -L https://fly.io/install.sh | sh
fly auth login
```

2) Run the provided deploy script (from repo root):

```bash
chmod +x scripts/deploy_to_fly.sh
./scripts/deploy_to_fly.sh hireconnect-api iad 1
```

This will:
- create a Fly app named `hireconnect-api` in region `iad` (change as needed),
- create a persistent volume `/data` (1GB),
- set `NODE_ENV=production` and `DB_PATH=/data/hireconnect.db`,
- deploy using the repository `Dockerfile`.

3) Seed the database (one-time):

```bash
fly ssh console -a hireconnect-api -- "node --experimental-strip-types --experimental-sqlite src/seed.ts"
```

4) Deploy the frontend to Vercel:
- In Vercel dashboard import this GitHub repo.
- Set Root Directory to `web-vite`.
- Build Command: `npm install && npm run build`
- Output Directory: `dist`
- Set environment variable at build-time: `VITE_API_BASE_URL` = `https://<your-fly-app>.fly.dev`

Notes

- If you prefer a single-host solution, you can deploy both backend and built frontend on Fly (serve static `dist` via a small static server), or use Render (persistent disk requires Starter plan).
- Fly's free tier limits may change; check Fly pricing for volumes and usage.
- If you want, I can add a GitHub Action to automatically deploy the frontend to Vercel and the backend to Fly on push.
