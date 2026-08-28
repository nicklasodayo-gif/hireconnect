# HireConnect — Architecture

## Overview

```
web/ (React via CDN, hash router)  --fetch/JSON-->  server/ (Node http + SQLite)
```

Three roles (job_seeker, employer, admin) share one `users` table with a
`role` discriminator and role-specific profile tables
(`candidate_profiles` / `employer_profiles` + `companies`). See
`docs/SCHEMA.sql` for the full normalized schema (users, sessions,
candidate/company profiles, jobs, applications + status history, saved
jobs/searches, interviews, conversations/messages, notifications, reviews,
reports, admin logs, industries/categories/skills — all with proper PKs,
FKs, indexes, and soft deletes where the data shouldn't disappear outright).

## Why no Express / Prisma / bcrypt

This was built in a sandbox with no network access to the npm registry. Two
choices followed from that constraint, both documented here so a future
maintainer understands *why*, not just *what*:

- **`node:http` instead of Express.** `server/src/router.ts` is a ~70-line
  router (path params, JSON body parsing, CORS headers) that mimics
  Express's `.get/.post/.put/.delete` API closely enough that migrating is
  mostly a search-and-replace of `router.get(path, handler)` →
  `app.get(path, expressHandler)` plus swapping `ctx.params`/`ctx.body` for
  `req.params`/`req.body`. Do this once you need Express's middleware
  ecosystem (helmet, compression, etc.).
- **`node:sqlite` instead of Prisma/pg.** Node 22.5+ ships a built-in
  synchronous SQLite driver (`node:sqlite`, currently experimental — run
  with `--experimental-sqlite`). All queries in `app.ts` are plain
  parameterized SQL strings via `db.prepare(...).run/get/all(...)`, which
  maps almost directly onto `pg`'s `pool.query(...)` or a Prisma
  `$queryRaw` — the SQL itself (see below) is close to Postgres-compatible
  already.
- **`node:crypto` scrypt instead of bcrypt.** `scrypt` is a memory-hard KDF
  built into Node with no native addon to compile — it's a legitimate
  bcrypt alternative, not just a workaround (see `server/src/auth.ts`).

## Scaling to Postgres

1. Replace `TEXT` timestamp columns with `timestamptz`, `INTEGER PRIMARY
   KEY` with `SERIAL`/`BIGSERIAL`, and SQLite's `datetime('now')` defaults
   with Postgres's `now()`.
2. Swap `node:sqlite`'s `DatabaseSync` for `pg.Pool` (or Prisma) in
   `server/src/db.ts`; the rest of `app.ts` needs minimal changes since
   query shapes are similar (biggest diff: `?` placeholders → `$1, $2, ...`
   if using raw `pg`, or none at all if you move to Prisma's query builder).
3. Everything in `docs/SCHEMA.sql` was written with FKs/indexes/constraints
   that map 1:1 onto Postgres equivalents.

## Matching engine

`server/src/matching.ts` is a deliberately **non-ML, fully explainable**
weighted scorer: skills (35%), experience (20%), location (15%), education
(10%), salary (10%), job type (10%). Each component returns both a score
and a human-readable label, which is what powers the "why this job matches
you" breakdown in the UI. The public shape (`MatchCandidate`/`MatchJob` in,
`MatchResult` out) is the seam where a future learned ranking model could
be swapped in — callers (`app.ts`, `seed.ts`) only depend on that shape, not
on how the score is computed. Per the spec, nothing in the UI or API claims
"AI-powered" matching, because there is no ML model behind it yet.

## Frontend build

`web/` currently loads React + Babel Standalone from a CDN and transpiles
JSX in the browser — zero build step, which is why it could be written and
statically verified in this sandbox without npm access. To move to a real
build for production:

1. `npm create vite@latest hireconnect-web -- --template react`
2. Copy `pages-*.js`, `components.js`, `api.js`, `config.js`, `app.js` in as
   `.jsx` files under `src/`; replace the `window.X = ...` exports with
   normal `export` statements and `window.X` references with regular
   imports (the components are already plain functions with no build-only
   syntax beyond JSX, so this is mechanical, not a rewrite).
3. Replace the hand-rolled hash router with `react-router-dom` if desired
   (optional — the current router is small enough to keep).

## Security notes

- Passwords: `scrypt` with a random salt per user, `timingSafeEqual` for
  comparison (`server/src/auth.ts`).
- Sessions: random 256-bit bearer tokens in a `sessions` table with
  expiry; logout deletes the token server-side (verified by an integration
  test).
- Authorization: every mutating route re-checks role and, for
  employer-owned resources, that the requesting user actually owns the
  company involved (`ownsJobsCompany` in `app.ts`) — verified by an
  integration test that a candidate cannot change another company's
  application status, and that a stranger cannot message into someone
  else's conversation.
- Rate limiting: in-memory sliding window on `/register`, `/login`,
  `/forgot-password` (`server/src/rateLimit.ts`) — fine for one process;
  swap for a Redis-backed limiter before running multiple instances.
- File uploads: extension allowlist (`.pdf/.doc/.docx`), 5MB cap, random
  server-side filenames, stored outside any statically-served directory,
  served only through an authenticated download route
  (`server/src/uploads.ts`).
- Secrets: none hardcoded; `.env.example` documents what a production
  deploy needs (JWT secret if you move to JWTs, email provider key).

## Analytics

Job `views` increment on `GET /api/jobs/:id`; employer dashboard aggregates
applications/shortlisted/interviews/hires per company
(`GET /api/employers/me/dashboard`); admin stats aggregate platform-wide
(`GET /api/admin/stats`). These are computed on read rather than via a
separate events table — fine at this scale; a dedicated `events` table
with async aggregation is the natural next step if traffic grows.
