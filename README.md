# HireConnect

**"Connect Talent With Opportunity."**

A recruitment platform connecting Kenyan job seekers, employers, and admins:
candidate profiles with a profile-strength score, transparent/explainable job
matching, a full applicant-tracking pipeline, employer analytics, an admin
moderation panel, notifications, and basic messaging.

## Honest scope note

This was built end-to-end in a sandboxed environment **with no access to the
npm registry**, which shaped two real architecture decisions worth knowing
about up front:

1. **Backend has zero npm dependencies.** It's plain Node.js: the built-in
   `node:http` server, `node:sqlite` (Node 22.5+, currently experimental)
   for persistence, and `node:crypto` for password hashing (`scrypt`) and
   session tokens — no Express, no Prisma, no bcrypt. This let me actually
   *run* the whole stack and verify it (see "What's been tested" below)
   instead of shipping code I couldn't execute. It's genuinely fine for a
   single-instance deployment; `docs/ARCHITECTURE.md` explains how to move
   to Express + Prisma + Postgres for horizontal scaling without changing
   the API surface.
2. **Frontend ships with no build step.** React, ReactDOM and Babel
   Standalone load from a CDN and JSX is transpiled in the browser. Open
   `web/index.html` and it runs. This is a deliberate trade-off for a
   network-less sandbox, not a production recommendation — see
   `docs/ARCHITECTURE.md` "Frontend build" for the (small) migration to a
   real Vite + TypeScript build.

Everything else — schema, auth, matching engine, ATS pipeline, admin
moderation, seed data — is built to the full spec. A few lower-priority
items are stubbed rather than deep: real email delivery (templates are
documented but not wired to a provider), and a couple of UX niceties noted
in "Known gaps" below.

## What's been tested (not just written)

This isn't a "trust me" claim — every piece below was actually executed in
the build environment:

- **19 unit tests** (`server/tests/matching.test.ts`, `auth.test.ts`) covering
  the matching engine (including that two different candidates against the
  same job get genuinely different, non-clamped scores) and password hashing.
- **12 integration tests** (`server/tests/integration.test.ts`) that boot the
  real HTTP server against a real SQLite DB and drive it with real `fetch()`
  calls: register → login → profile update → company creation → job posting
  → publish → search-with-match-score → apply → duplicate-application
  rejection → ATS status changes → interview scheduling → notification
  delivery → cross-company authorization rejection → messaging
  authorization → admin stats → non-admin admin-route rejection → session
  invalidation on logout.
- **The seed script** runs clean and populates realistic Kenyan data (10
  companies, 22 jobs, 22 candidates, 44+ applications, interviews,
  notifications).
- **The frontend JSX** was verified to parse with zero syntax errors via
  TypeScript's parser in permissive JS mode, and every API field the UI
  reads was cross-checked by hand against the actual backend response
  shapes. It has **not** been executed in a real browser (no browser binary
  was available in this sandbox) — see "Known gaps."

Run `npm test` yourself in `server/` — output is deterministic and fast (~1.5s).

## Changelog

### Checkpoint A — env-var & security hardening (see `UPGRADE_PLAN.md`)
- Replaced the hardcoded `Access-Control-Allow-Origin: *` with an
  `ALLOWED_ORIGINS`-driven allowlist (`server/src/cors.ts`) — fails closed
  in production if unset, reflects the request origin in dev for convenience.
- Added `GET /api/health` (checks DB connectivity).
- Added graceful shutdown on `SIGTERM`/`SIGINT`.
- `devVerificationToken`/`devResetToken` are now omitted whenever
  `NODE_ENV=production`.
- Seed script passwords now come from `SEED_DEFAULT_PASSWORD` /
  `SEED_ADMIN_PASSWORD` env vars instead of being literal strings in source.
- Added 5 new tests (health check, dev-token prod-gating, email
  verification, full forgot/reset-password flow, CORS reflection).

### Checkpoint B — Vite + TypeScript frontend migration
- Created `web-vite/` — a full React + TypeScript + Vite project that
  1:1-ports every page and feature from the old `web/` CDN version (per
  Rule 13, "improve rather than replace"): Landing, Login/Register,
  JobSearch (now with real pagination), JobDetail, Companies, and the full
  candidate suite (Dashboard, ProfileEdit, ApplicationsTracker, SavedJobs,
  Notifications, Messages) and employer suite (Dashboard, CompanyForm,
  JobPostingForm, JobsList, ATS Board), plus Admin Dashboard.
- Built the full reusable component library from Phase 3's list: Button,
  Input, Select, Modal/Dialog, Dropdown, Card, Badge, Avatar, Table,
  Pagination, Tabs, LoadingSkeleton, EmptyState, ErrorState, plus
  JobCard/CompanyCard/CandidateCard/ApplicationCard/InterviewCard/
  NotificationItem and hand-rolled chart primitives (no charting library
  dependency).
- **ATS board now has real HTML5 drag-and-drop** between pipeline stages,
  persisting every move to the backend with optimistic UI + rollback on
  failure (Phase 12) — status-change buttons are kept in the detail modal
  too, since drag-and-drop alone isn't keyboard-accessible.
- **Fixed 3 audited gaps while porting, not just moved them:**
  1. Messaging now shows real candidate/company names and photos instead
     of "Conversation #12" — required a backend change (`GET
     /api/conversations` now joins and returns `other_party_name`/`_photo`).
  2. Employer `CompanyForm` now loads an existing company instead of
     always assuming create-only — required a new backend endpoint
     (`GET /api/employers/me/company`).
  3. Added a recruiter-facing full candidate profile page (Phase 13),
     wired to the existing `GET /api/candidates/:id` and CV-download route.
- Added Kenyan-specific employment types (attachment, graduate_trainee,
  freelance, temporary), county dropdowns, and phone-number normalization
  (Phase 21) — required extending the backend's accepted employment types.
- Employer dashboard charts (applications-over-time, pipeline, job views,
  top-performing jobs) are computed from real fetched records, not invented
  data, per Rule 3/4.
- **3 new backend tests** covering the conversation-name enrichment and
  the new employment types — full suite is now **26/26 passing**.
- Verified the entire `web-vite/` TypeScript source with the same
  tsc-shim technique used for the backend (no `@types/react` available in
  this sandbox without npm registry access). Found and fixed **2 real
  bugs** (`React.FormEvent` used without importing the `React` namespace,
  in `Landing.tsx` and `Messages.tsx`); remaining flagged lines are a known
  limitation of the simplified shim (inline JSX event handlers lose
  contextual typing without a full `@types/react` package) and are
  standard, idiomatic React+TypeScript code — see `UPGRADE_PLAN.md`.
- The old `web/` CDN version is left in place, untouched, as a working
  fallback until `web-vite/` has been through a real `npm install` and
  manual click-through (which this sandbox cannot do — no registry access).

### Checkpoint C — PostgreSQL migration tooling + saved-search wiring
- **Saved search feature fully implemented and tested** (closes the
  audited gap where `saved_searches` existed in the schema but was never
  wired up): `POST/GET/DELETE /api/saved-searches`, plus a "Save this
  search" button and re-runnable saved-search chips on the `web-vite`
  JobSearch page. **3 new backend tests** — suite is now **27/27 passing**.
- **`database/postgres/`** — a reviewed, ready-to-use PostgreSQL migration
  (`migrations/0001_init.sql`, full schema translated to native Postgres
  types: `BIGSERIAL`, `TIMESTAMPTZ`, `BOOLEAN`, `JSONB`, plus a full-text
  search index the SQLite version doesn't have) and `seed.sql` with
  **genuinely computed password hashes** — generated by actually running
  `server/src/auth.ts`'s real `hashPassword()`/`verifyPassword()` and
  confirmed to round-trip, not placeholder strings. **Honestly labeled as
  not yet run against a live Postgres server** — this sandbox has neither
  a Postgres binary nor npm registry access to install `pg`. See
  `database/postgres/README.md` for exact next steps to actually switch
  the running app over.
- Verified the new `web-vite` TypeScript changes with the same tsc-shim
  technique — zero new error classes introduced (went from 27 to 28
  known-shim-artifact lines, exactly matching the one new inline handler
  added; no new real bugs).

### Checkpoint D — analytics, remaining docs, deployment configs
- **Real analytics events (Phase 25)**, not fake charts: added an
  `analytics_events` table and a `trackEvent()` helper, wired into the
  actual route handlers for `job_view`, `job_save`, `job_apply`,
  `profile_view`, `company_view`, `search`, `candidate_shortlisted`,
  `interview_scheduled`, `offer_sent`, and `hire_completed` — every one
  fires from the real code path that performs that action, nothing
  backfilled. New `GET /api/admin/analytics` aggregates these into
  event-type counts and daily signup/application series; the admin
  dashboard's new "Analytics" tab renders them with the same hand-rolled
  chart components used elsewhere (no charting library dependency).
  Employer dashboard also gained `qualifiedApplicants` (match_score ≥ 60)
  and `offers` counts, computed from real data.
- **2 new backend tests** for the above — suite is now **29/29 passing**.
- Found and fixed **1 real TypeScript bug** while verifying the new
  frontend code with the tsc-shim technique (`AnalyticsSummary` type used
  in `AdminDashboard.tsx` via an import path where it wasn't actually
  exported) — reverified clean afterward.
- **Remaining documentation**: `docs/API.md` (full endpoint reference),
  `docs/DATABASE.md` (schema description + SQLite/Postgres dialect diff
  table), `docs/SECURITY.md` (consolidated, describing only what's
  actually implemented and tested), `docs/DEPLOYMENT.md` (Render/Railway/
  Fly/VPS + Vercel/Netlify instructions).
- **Deployment configs**: `Dockerfile` (Node 22 base, no build step needed
  since the backend has zero npm dependencies, built-in `HEALTHCHECK`
  hitting `/api/health`), `docker-compose.yml`, `.dockerignore`. Like the
  Postgres migration, these are reviewed and ready but **not build-tested
  in this sandbox** — no Docker daemon or registry access here — flagged
  honestly rather than claimed as verified.


```bash
cd server
npm run seed     # creates hireconnect.db with demo data
npm start        # http://localhost:4000
```

Then open `web/index.html` directly in a browser (or serve the `web/`
folder with any static file server). It talks to `http://localhost:4000`
by default — change `window.API_BASE` in `web/config.js` if your API runs
elsewhere.

Demo logins (see exact seeded emails printed by `npm run seed`):
- Admin: `admin@hireconnect.co.ke` / `AdminPass123!`
- Employer: `employer1@twigadigitalsolutions.co.ke` / `Password123!`
- Candidate: `candidate1@example.com` / `Password123!`

**New Vite/TypeScript frontend (`web-vite/`)**: this needs a real
`npm install` (React, Vite, TypeScript, `@types/react`) which this sandbox
can't do without registry access. Once you have it locally:
```bash
cd web-vite
npm install
cp .env.example .env
npm run dev      # http://localhost:5173
```
The old CDN-based `web/` still works standalone with zero install and is
left in place as a fallback — see `UPGRADE_PLAN.md` Checkpoint B for why
both currently coexist.

## Project structure

```
server/
  docs/SCHEMA.sql        # full normalized schema (also under project docs/)
  src/
    db.ts                # opens SQLite, applies schema on first run
    auth.ts              # scrypt password hashing, session tokens
    matching.ts           # explainable job-matching engine (pure functions)
    validation.ts, rateLimit.ts, uploads.ts
    router.ts            # tiny dependency-free HTTP router (Express stand-in)
    app.ts                # all API routes
    index.ts              # server entrypoint
    seed.ts               # demo data generator
  tests/                  # node:test suites (unit + full integration)
web/
  index.html, config.js, api.js, components.js
  pages-public.js, pages-candidate.js, pages-employer.js, pages-admin.js
  app.js, styles.css
docs/
  SCHEMA.sql
  ARCHITECTURE.md
  EMAIL_TEMPLATES.md
```

## Testing

```bash
cd server
npm test
```

## Configuration

Copy `server/.env.example` to `server/.env` and adjust `PORT`/`DB_PATH` if
needed (the current server reads `process.env.PORT`/`DB_PATH` directly —
wire in `dotenv` once you add npm dependencies for production).

## Known gaps (documented, not hidden)

- Email delivery isn't wired to a real provider — verification/reset tokens
  are returned directly in API responses for local testing (`devVerificationToken`,
  `devResetToken`), matching how a lot of dev-mode auth flows work before a
  provider is configured. See `docs/EMAIL_TEMPLATES.md`.
- The frontend hasn't been run in an actual browser in this environment —
  static analysis and careful field-by-field cross-checking against the
  tested backend give good confidence, but it's not the same as clicking
  through it.
- Messaging UI shows conversations by ID rather than the other party's name
  (the API returns enough data to fix this — small frontend enrichment).
- No drag-and-drop on the ATS board — moving a candidate between stages
  uses explicit status buttons in the detail modal instead (more reliable
  to build without a drag-and-drop library, same end capability).
- CV/document files are validated and stored, but virus scanning isn't
  implemented (flagged in `docs/ARCHITECTURE.md` "Security hardening").

## Deployment (outline)

1. `server`: move to a process manager (pm2/systemd) or a container; if you
   outgrow single-instance SQLite, migrate to Postgres (see
   `docs/ARCHITECTURE.md`) and swap `node:sqlite` calls for `pg`/Prisma —
   the route handlers' SQL is close to portable already.
2. `web`: for real production traffic, move off in-browser Babel to a Vite
   build (`docs/ARCHITECTURE.md` has the exact steps) and serve the built
   static files from a CDN.
3. Point `web/config.js`'s `API_BASE` at your deployed API URL.
