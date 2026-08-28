# HireConnect Database

Two schemas exist, deliberately:

- **`docs/SCHEMA.sql`** — SQLite dialect, applied automatically by
  `server/src/db.ts` on first run. This is what the application actually
  runs against today, and what all 29 tests exercise.
- **`database/postgres/migrations/0001_init.sql`** — the reviewed,
  ready-to-use Postgres translation (Phase 24), not yet run against a live
  database in this environment (no Postgres binary / npm registry access
  here — see `database/postgres/README.md`).

Both describe the same 27 tables. This document describes the shape once,
noting dialect differences inline rather than duplicating two full
descriptions.

## Entity groups

**Identity**: `users` (role: job_seeker/employer/admin, soft-deletable),
`sessions` (bearer tokens), `password_resets`.

**Candidate**: `candidate_profiles` (1:1 with `users`), `candidate_languages`,
`education`, `experience`, `certifications`, `candidate_skills` (M:N to
`skills`).

**Employer**: `employer_profiles` (1:1 with `users`, optional FK to a
`companies` row), `companies` (moderation `status`: pending/approved/
rejected/suspended, `verified` boolean).

**Jobs**: `jobs` (FK to `companies`, soft-deletable, `status`:
draft/published/paused/closed), `job_skills` (M:N to `skills`, `required`
flag), `job_categories`, `industries`.

**Applications**: `applications` (unique on `(job_id, candidate_id)` — the
DB itself prevents duplicate applications, not just app-layer logic),
`application_status_history` (append-only audit trail of every status
change), `application_notes` (recruiter-internal notes), `interviews` (FK
to `applications`).

**Engagement**: `saved_jobs`, `saved_searches` (query stored as JSON),
`followed_companies`, `conversations` + `messages`, `notifications`.

**Trust & safety**: `reports` (target_type: job/company/user/message,
status: pending/reviewed/dismissed), `admin_logs` (every admin action),
`reviews`.

**Analytics** (Phase 25): `analytics_events` — `event_type` (job_view,
job_save, job_apply, profile_view, company_view, search,
candidate_shortlisted, interview_scheduled, offer_sent, hire_completed),
optional `user_id`/`entity_type`/`entity_id`/`metadata`. Populated by real
route handlers in `server/src/app.ts` (see `docs/API.md` for exactly which
endpoints track which event), never backfilled or invented.

## Key constraints worth knowing about

- `applications` has `UNIQUE (job_id, candidate_id)` — the "can't apply
  twice" rule is enforced at the database level, not just checked in code
  (though the app also checks first, to return a friendly error instead of
  a raw constraint violation).
- `conversations` has `UNIQUE (candidate_user_id, employer_user_id,
  application_id)` — starting a conversation for the same application
  twice returns the existing one instead of creating a duplicate.
- Soft deletes (`deleted_at`) on `users`, `companies`, and `jobs` — deleted
  rows are excluded from normal queries via `WHERE deleted_at IS NULL`
  rather than being physically removed, so history/audit trails referencing
  them stay intact.

## Dialect differences (SQLite → Postgres)

| SQLite | Postgres | Why |
|---|---|---|
| `INTEGER PRIMARY KEY` | `BIGSERIAL PRIMARY KEY` | Postgres has no rowid-alias shortcut |
| `TEXT` timestamps + `datetime('now')` | `TIMESTAMPTZ` + `now()` | Native timezone-aware type |
| `INTEGER` 0/1 for booleans | `BOOLEAN` | Native boolean type |
| `TEXT` for JSON columns | `JSONB` | Indexable, queryable JSON |
| plain `LIKE '%...%'` job search | GIN full-text index | Real search relevance instead of a substring scan |

## Running queries directly

SQLite: `sqlite3 server/hireconnect.db` (after `npm run seed`), or use any
SQLite browser against that file.

Postgres (once migrated): `psql "$DATABASE_URL"`.
