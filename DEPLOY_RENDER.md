Deploy HireConnect to Render (Backend) and Vercel (Frontend)

This guide walks through deploying the existing HireConnect app with minimal changes:

- Backend API: Render (Docker web service + persistent disk for SQLite)
- Frontend: Vercel (static site built from `web-vite`)

Prerequisites
- GitHub repository with this project
- Render account
- Vercel account

Render — backend
1. In Render dashboard create a new Web Service → "Deploy from Git"
2. Select this repository and branch `main`.
3. Choose runtime: **Docker** (repo root contains `Dockerfile`).
4. Plan: choose any plan that supports persistent disks (starter or above).
5. Under Advanced / Disk settings, add a persistent disk mounted at `/data` (1GB is fine for demo).
6. Environment variables (set under the service):
   - `NODE_ENV=production`
   - `DB_PATH=/data/hireconnect.db`
   - `ALLOWED_ORIGINS` = your frontend origin (e.g. `https://your-frontend.vercel.app`)
   - Optional: `SEED_ADMIN_PASSWORD`, `SEED_DEFAULT_PASSWORD` if you plan to run the seed script with custom passwords.
7. Health check path: `/api/health` (already present in the app).
8. Deploy. After the service is live, open the Render Shell (Dashboard → Instances → Shell) and run the one-time seed if desired:

```bash
# inside render shell (repo root)
node --experimental-strip-types --experimental-sqlite server/src/seed.ts
```

Vercel — frontend
1. Import project into Vercel.
2. When configuring the project, set the Root Directory to `web-vite`.
3. Build command: `npm ci && npm run build`.
4. Output Directory: `dist`.
5. Add Environment Variable (Project → Settings → Environment Variables):
   - `VITE_API_BASE_URL` = `https://<your-render-api-host>` (use the public URL Render shows for your API service)
6. Deploy. Ensure that client-side routing works; `vercel.json` in `web-vite/` rewrites to `index.html` to keep deep links working.

Notes / Considerations
- The backend currently uses SQLite stored on a persistent disk. If you prefer Supabase (Postgres) later, a migration plan is required — do not change DB now if you want a fast deploy.
- File uploads are stored on the instance filesystem (`server/uploads`). For production durability and scaling, move uploads to object storage (Supabase Storage, S3, etc.).
- Ensure `ALLOWED_ORIGINS` includes the final Vercel domain; the server fails closed for CORS when `NODE_ENV=production`.

If you want, I can create a Render Blueprint (`render.yaml`) or help you run the seed and verify the deployed endpoints.
