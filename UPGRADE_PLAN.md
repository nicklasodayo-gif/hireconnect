# HireConnect — Upgrade Plan

_Audit performed by inspecting the actual repository (not written from
assumptions). File sizes at time of audit: `server/src/app.ts` 906 lines,
`web/*.js` ~1,478 lines across 8 files, `docs/SCHEMA.sql` 323 lines._

## 1. Current architecture

```
web/  (React 18 UMD + Babel Standalone via CDN, no build step, hash router)
        │  fetch() + Bearer token in localStorage
        ▼
server/ (Node http + node:sqlite + node:crypto, zero npm deps, one process)
        │
        ▼
hireconnect.db (single SQLite file)
```

- **Frontend**: `web/index.html` loads React/ReactDOM/Babel from `unpkg.com`
  and transpiles JSX in-browser. 8 plain `<script>` files sharing global
  scope (`config.js`, `api.js`, `components.js`, `pages-{public,candidate,
  employer,admin}.js`, `app.js`). Routing is a ~15-line hand-rolled hash
  router in `app.js`. No bundler, no code splitting, no TypeScript on the
  frontend at all.
- **Backend**: `server/src/app.ts` (906 lines) is a single file containing
  every route handler for auth, candidates, companies, jobs, applications,
  interviews, messages, notifications, reports, and admin. Routing goes
  through a hand-rolled `Router` class (`router.ts`, 80 lines) that mimics
  Express's `.get/.post/.put/.delete` API. No middleware layering — auth
  checks are inline function calls (`requireAuth`, `requireRole`) at the
  top of each handler.
- **Database**: SQLite via Node's built-in (experimental) `node:sqlite`
  driver, one file, opened synchronously. Schema in `docs/SCHEMA.sql`, 26
  tables, applied once on first run if the DB file doesn't exist yet (no
  migration history/versioning — see "Database issues").
- **Auth**: bearer tokens in a `sessions` table (not JWT — a DB-backed
  opaque token, which is actually a reasonable choice, see below).
  Passwords hashed with `scrypt` (Node built-in, no bcrypt dependency).

## 2. Existing features (confirmed present and working)

Candidate accounts, employer accounts, admin accounts, registration/login/
logout/forgot-password/reset-password/email-verification, role-based
access control, candidate profiles (bio, skills, education, experience,
certifications, languages, CV upload, preferences, profile-completion
score), job posting + draft/publish/pause/close/duplicate/delete, job
search with filters/sort, explainable job matching with a top-N ranking
and reason list, applications with a 7-stage status pipeline + full status
history, an ATS view grouped by status (button-based stage changes, not
drag-and-drop), candidate notes, candidate ratings, interview scheduling
(6 types), conversations/messages with real authorization checks, saved
jobs, company profiles + follow, admin dashboard with platform stats,
user suspend/restore/delete, company approve/reject, report review, audit
logs, in-app notifications, CV upload with extension/size validation and
authenticated-only download, per-endpoint rate limiting on
register/login/forgot-password, a Kenyan-flavored seed script (10
companies, 22 jobs, 22 candidates, 44 applications), and dark mode (CSS
variables + a toggle persisted to `localStorage`).

**This confirms the brief's premise: there is substantial real
functionality here.** Nothing above is a mockup — every one of these was
covered by the 20 integration/unit tests in `server/tests/`.

## 3. Problems discovered

### Security issues (real, found by grep, not hypothetical)
1. **`Access-Control-Allow-Origin: *`** in both `router.ts` and
   `index.ts` (its OPTIONS-preflight handler). This is explicitly called
   out as unacceptable for production in the brief, and it's really there.
   Needs an allowlist driven by an `ALLOWED_ORIGINS` env var.
2. **Seed data uses literal passwords** (`"Password123!"`,
   `"AdminPass123!"`) directly in `seed.ts` source. Fine for a seed script
   whose whole purpose is known demo credentials, but they should come
   from env vars (`SEED_DEFAULT_PASSWORD`) so they're not the same
   literal string committed to every clone of the repo, and so production
   seeding (if ever run) can't silently reuse a public string.
3. **Dev-mode tokens returned in API responses**
   (`devVerificationToken`, `devResetToken` in `app.ts`) are fine for a
   sandbox with no email provider, but they must be removed/gated behind
   `NODE_ENV !== 'production'` before this ships, or any user can
   self-verify or reset any account's password by reading their own
   registration response for someone else's email (actually — re-checking
   `app.ts`: the reset token is only returned in the response for the
   *email that was just requested*, not an arbitrary account, so this
   isn't an account-takeover bug today, but shipping it to production
   would leak reset tokens to anyone who controls that inbox's HTTP
   client, which defeats the purpose of emailing them separately. Must be
   removed once real email sending exists.)
4. **No CSRF protection** — not currently exploitable because auth is
   bearer-token-based (not cookies), so CSRF is largely moot as-is, but if
   session cookies are introduced later this needs revisiting.
5. **No global rate limiting** beyond the three explicitly-listed routes;
   the ATS/messaging/job-posting endpoints have no throttling at all.
6. **In-memory rate limiter** (`rateLimit.ts`) resets on every process
   restart and doesn't work across multiple instances — fine for one
   process, a real production blocker the moment this scales horizontally.
7. **No input length caps on some fields** (e.g. `bio`, `description`)
   beyond what `isNonEmptyString`'s default `maxLen=5000` provides —
   acceptable but worth an explicit review pass per field.

### UX issues
1. Messaging UI shows "Conversation #12" instead of the other party's
   name/photo (flagged already in the original README's "Known gaps").
   The API has the data (`candidate_user_id`/`employer_user_id`); the
   frontend just never joined against a name.
2. No drag-and-drop on the ATS board — stage changes happen via buttons in
   a modal. Functionally complete, but the brief explicitly asks for
   Kanban drag-and-drop.
3. No loading/error states on a few secondary views (e.g. `CompanyForm`
   silently does nothing useful if the company already exists — there's
   no "load existing company" call, so an employer with a company already
   made via seed data can't see/edit it from that form today — this is a
   **real incomplete feature**: `CompanyForm` always assumes create-only).
4. No pagination UI on job search results even though the API returns
   `page`/`pageSize`/`total` — the frontend fetches page 1 and never
   offers "next page."
5. No saved-search feature in the UI at all, despite `saved_searches`
   existing in the schema — it was never wired to any route or page.

### Performance issues
1. `GET /api/jobs` computes a match score **per row, per request** by
   re-running `calculateMatch` for every job on every search — fine at
   current seed-data scale (22 jobs), but this is an N-per-request
   computation with several nested `db.prepare(...).all()` calls per job
   (`jobToMatchJob` and `candidateToMatchCandidate` both run additional
   queries), so it's effectively O(jobs × subqueries) per search request.
   At real scale this needs either caching candidate/job vectors or moving
   matching to a background/materialized step.
2. No HTTP caching headers anywhere (all responses are freshly computed,
   including largely-static data like `/api/industries`, `/api/skills`).
3. `node:sqlite`'s `DatabaseSync` is fully synchronous — every query
   blocks the single Node event loop thread. Fine for a demo; a genuine
   concurrency bottleneck under real multi-user load.

### Database issues
1. **No migration system** — `db.ts` applies the entire `SCHEMA.sql` once
   if the file is new, and never again. There is no way to evolve the
   schema on an existing database without a manual migration script. This
   is the single biggest structural gap for "production-ready."
2. SQLite-specific syntax throughout (`datetime('now')`,
   `INTEGER PRIMARY KEY` as rowid, `PRAGMA foreign_keys`) — all portable to
   Postgres but not automatically.
3. No connection pooling (moot for SQLite, required once on Postgres).

### Production deployment issues
1. No `Dockerfile`/container setup.
2. No `GET /api/health` endpoint (explicitly requested in this brief).
3. No process-manager config (pm2/systemd) or graceful shutdown handling
   (`server.close()` on SIGTERM).
4. Frontend has no production build — shipping `unpkg.com`-loaded
   React/Babel to real users means a runtime JSX-transpile cost and a
   hard external dependency on a third-party CDN staying up.
5. No environment-driven CORS origin, as above.

### Technical debt
1. `server/src/app.ts` at 906 lines holding every resource's routes is
   the biggest maintainability issue — should be split by resource
   (`routes/auth.ts`, `routes/jobs.ts`, `routes/applications.ts`, etc.)
   now that the route count has grown this large.
2. Frontend has zero TypeScript — every `props`/API response is
   implicitly `any`. This was a deliberate original trade-off (no bundler
   available in the build sandbox) but is real debt now.
3. Some repeated SQL patterns (ownership checks, status-history inserts)
   could be extracted into small repository-style helpers instead of
   being re-written per route.

## 4. Recommended architecture (target state)

```
apps/
  web/        React + TypeScript + Vite, real build, code-split routes
  api/        Node + TypeScript, Express (or keep the thin router — see
              below), route modules per resource, Zod-style validation
packages/
  shared-types/   Types shared between web and api (Job, Application, ...)
database/
  postgres, migrations via a real migration tool (node-pg-migrate or
  Prisma), seed script ported from the current one
```

**Note on Express vs. the current router**: the current `router.ts` is a
faithful, tested, ~80-line stand-in for Express built specifically because
this was developed without npm registry access. In an environment with
real npm access, migrating to Express is a small mechanical change (the
API is already `.get/.post/.put/.delete(path, handler)` shaped) — not a
rewrite. Same logic applies to `node:sqlite` → `pg`/Prisma.

## 5. Upgrade phases (this plan's execution order)

Given the scope of the original request (33 phases) and that each phase
must leave the app runnable and tested before the next begins, phases are
grouped into checkpoints rather than attempted all at once in a single
pass:

- **Checkpoint A** (this document + immediate next): environment-variable
  hardening (CORS allowlist, remove hardcoded seed passwords, health
  endpoint), since these are small, high-value, and zero-risk to existing
  functionality.
- **Checkpoint B**: Vite + TypeScript frontend migration, porting the
  existing 8 JS files into typed components 1:1 (same behavior, same API
  calls) before adding any new features — "port, then improve," per Rule
  13.
- **Checkpoint C**: PostgreSQL migration + migration tooling, ATS
  drag-and-drop, messaging name/photo display, saved search wiring,
  employer company-edit fix.
- **Checkpoint D**: analytics events table, admin analytics pages,
  documentation set (API.md, DATABASE.md, DEPLOYMENT.md, SECURITY.md),
  deployment configs.

Each checkpoint ends with the existing test suite re-run and a written
summary of what changed — per Rule 19 and the brief's "after each phase"
instructions.
