# HireConnect Security

Everything in this document describes what's actually implemented and
tested (`server/tests/integration.test.ts`, 29 tests), not a wishlist.

## Authentication

- Passwords hashed with `scrypt` (Node's built-in, memory-hard KDF — no
  external `bcrypt` dependency needed) with a random salt per user
  (`server/src/auth.ts`). Verified: hashing the same password twice
  produces different hashes; wrong passwords are rejected via
  `timingSafeEqual` (constant-time comparison, not `===`).
- Sessions are random 256-bit bearer tokens stored server-side in a
  `sessions` table with an expiry, not JWTs — this means a compromised
  token can be revoked immediately (`DELETE FROM sessions`) rather than
  waiting out an expiry window. Logout deletes the token; password reset
  deletes *all* sessions for that user (tested: an old session is rejected
  immediately after a password reset, and the reset token itself can't be
  reused).
- Email verification and password reset tokens are cryptographically
  random (`crypto.randomBytes`), single-use (reset tokens are marked
  `used_at` and rejected on reuse — tested), and time-limited (30 minutes
  for reset tokens).

## Authorization

- Every mutating route re-checks the caller's role (`requireRole`) and,
  for employer-owned resources, that the requester actually owns the
  company involved (`ownsJobsCompany` in `app.ts`) — not just that they're
  *an* employer. Tested: a candidate cannot change another company's
  application status (403); a stranger cannot post messages into someone
  else's conversation (403); a non-admin cannot reach any `/api/admin/*`
  route (403).
- CV downloads (`GET /api/candidates/:id/cv`) require `employer` or
  `admin` role — there is no public URL for a candidate's CV file.

## CORS

- No wildcard `Access-Control-Allow-Origin: *` in this codebase (it was
  removed during the Checkpoint A hardening pass — see `UPGRADE_PLAN.md`).
  `server/src/cors.ts` reads an `ALLOWED_ORIGINS` env var (comma-separated
  list); in production, if it's unset, **no CORS header is sent at all**
  (fail closed — same-origin only) rather than defaulting to permissive.
  Outside production it reflects the request's own origin for local-dev
  convenience, with a one-time console warning.

## Rate limiting

- In-memory sliding-window limiter (`server/src/rateLimit.ts`) on
  `/register`, `/login`, `/forgot-password`. Documented limitation: this
  resets on process restart and doesn't coordinate across multiple
  instances — fine for a single process, needs a shared store (Redis) the
  moment this runs on more than one instance. See `UPGRADE_PLAN.md`.

## Input validation

- `server/src/validation.ts`: email format, password minimum length (8),
  string length caps, enum membership checks (`isOneOf`) used for role,
  employment type, application status, interview type, report target
  type, etc. Every `ValidationError` maps to a 400 response with a plain
  message, never a raw stack trace or SQL error.
- SQL injection: every query in `app.ts` uses parameterized
  `db.prepare(sql).run/get/all(...params)` — no string interpolation of
  user input into SQL anywhere in the codebase (verified by inspection
  during the Phase 1 audit).
- XSS: this is a JSON API: the backend never renders user input into
  HTML. The frontend (both `web/` and `web-vite/`) uses React's default
  text-node rendering (`{value}`), which escapes by default; no
  `dangerouslySetInnerHTML` is used anywhere.
- CSRF: not applicable in its usual form here, since auth is bearer-token
  (sent explicitly in an `Authorization` header, not an ambient cookie) —
  there's no cookie for a forged cross-site request to ride along on. If
  session cookies are introduced later, this needs revisiting.

## File uploads (CVs)

- `server/src/uploads.ts`: extension allowlist (`.pdf`, `.doc`, `.docx`
  only — executables and scripts are rejected outright), 5MB size cap,
  empty-file rejection, and randomly generated server-side filenames
  (`crypto.randomUUID()`) so the original filename never becomes a
  guessable or path-traversal-exploitable storage path.
- Files are stored under `server/uploads/`, which is never served as a
  static directory — the only way to retrieve a file is through the
  authenticated `GET /api/candidates/:id/cv` route, which re-checks
  `employer`/`admin` role first.
- `readUploadedFile` explicitly rejects any stored filename containing
  `..`, `/`, or `\` before touching the filesystem, as defense in depth
  against path traversal even though filenames are server-generated.
- **Not yet implemented**: antivirus/malware scanning of uploaded files.
  The architecture is ready for it — `saveBase64File` returns a stored
  filename before any further processing, so a scanning step could be
  inserted there without restructuring the upload flow — but no scanner is
  wired in. Flagged here rather than silently omitted.

## Secrets

- No secrets are hardcoded in source. `server/.env.example` and
  `web-vite/.env.example` document every configuration value a real
  deployment needs (DB path/URL, `ALLOWED_ORIGINS`, seed passwords, and
  placeholders for `JWT_SECRET`/email provider keys for when those
  features are wired up).
- Seed script demo passwords come from `SEED_DEFAULT_PASSWORD`/
  `SEED_ADMIN_PASSWORD` env vars (with a documented literal fallback
  clearly marked "never reuse in production"), not committed as the only
  option in source.
- Dev-only fields (`devVerificationToken`, `devResetToken`, present so
  registration/reset can be tested end-to-end without a real email
  provider) are omitted entirely whenever `NODE_ENV=production` — tested.

## Known gaps (see `UPGRADE_PLAN.md` for the full list)

- No malware scanning on uploads (above).
- Rate limiting is single-process only.
- No JWT/OAuth support yet (bearer-token sessions only) — fine for the
  current architecture, worth revisiting if third-party integrations need
  a standard token format.
