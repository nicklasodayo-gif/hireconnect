# HireConnect API Reference

Base URL: `http://localhost:4000` (or `API_BASE`/`VITE_API_BASE_URL`).
All request/response bodies are JSON. Authenticated routes require
`Authorization: Bearer <token>` (obtained from `/api/auth/login`).

Every endpoint below is implemented in `server/src/app.ts` and exercised by
`server/tests/integration.test.ts` (29 tests, all passing as of this
writing) — this document describes what's actually there, not a plan.

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | `{ email, password, role: "job_seeker"\|"employer", fullName?, companyName? }`. Returns `devVerificationToken` outside production. |
| POST | `/api/auth/verify-email` | — | `{ token }` |
| POST | `/api/auth/login` | — | `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/logout` | ✓ | Revokes the current session token |
| POST | `/api/auth/forgot-password` | — | `{ email }`. Always returns the same message whether the account exists; returns `devResetToken` outside production |
| POST | `/api/auth/reset-password` | — | `{ token, password }`. Revokes all existing sessions for that user |
| GET | `/api/auth/me` | ✓ | Current user |

## Candidates

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/candidates/me` | job_seeker | Full profile incl. skills/education/experience/`missing` field checklist |
| PUT | `/api/candidates/me` | job_seeker | Partial update (camelCase body keys) |
| POST | `/api/candidates/me/skills` | job_seeker | `{ name, level? }` |
| POST | `/api/candidates/me/education` | job_seeker | `{ institution, degree, field?, startYear?, endYear? }` |
| POST | `/api/candidates/me/experience` | job_seeker | `{ company, title, startDate?, endDate?, isCurrent?, description? }` |
| POST | `/api/candidates/me/cv` | job_seeker | `{ fileName, base64 }` — PDF/DOC/DOCX only, 5MB max |
| GET | `/api/candidates/:id` | employer, admin | Full candidate profile (tracks a `profile_view` analytics event) |
| GET | `/api/candidates/:id/cv` | employer, admin | Streams the stored CV file |

## Companies

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/companies` | — | Approved companies, paginated |
| GET | `/api/companies/:id` | — | Company + open jobs (tracks `company_view`) |
| POST | `/api/companies` | employer | Creates a company (status starts `pending`) |
| PUT | `/api/companies/:id` | employer (owner), admin | Update |
| POST | `/api/companies/:id/follow` | job_seeker | Follow a company |

## Jobs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs` | optional | Search/filter/sort/paginate. Query: `q, location, employmentType, workMode, experienceLevel, minSalary, companyId, sort, page`. Includes `matchScore` per job when authenticated as a candidate. Tracks a `search` event when filters are present. |
| GET | `/api/jobs/recommended` | job_seeker | Top 20 published jobs ranked by match score |
| GET | `/api/jobs/:id` | optional | Job detail (increments `views`, tracks `job_view`) |
| GET | `/api/jobs/:id/match` | job_seeker | Full `MatchResult` breakdown |
| POST | `/api/jobs` | employer | Create (requires an existing company) |
| PUT | `/api/jobs/:id` | employer (owner), admin | Update |
| POST | `/api/jobs/:id/publish` \| `/pause` \| `/close` | employer (owner), admin | Status transitions |
| POST | `/api/jobs/:id/duplicate` | employer (owner), admin | Clone as a new draft |
| DELETE | `/api/jobs/:id` | employer (owner), admin | Soft delete |
| POST/DELETE | `/api/jobs/:id/save` | job_seeker | Save/unsave (tracks `job_save`) |
| GET | `/api/saved-jobs` | job_seeker | List saved jobs |
| POST | `/api/jobs/:id/apply` | job_seeker | `{ coverNote? }`. Rejects duplicate applications. Tracks `job_apply`. |

## Saved searches

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/saved-searches` | job_seeker | `{ name?, query: {...same filters as job search...} }` |
| GET | `/api/saved-searches` | job_seeker | List (query parsed back to an object) |
| DELETE | `/api/saved-searches/:id` | job_seeker | Remove |

## Employer

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/employers/me/jobs` | employer | This employer's job postings |
| GET | `/api/employers/me/dashboard` | employer | `activeJobs, totalApplications, shortlisted, interviews, offers, hires, qualifiedApplicants (match_score >= 60), profileViews` |
| GET | `/api/employers/me/company` | employer | The employer's own company, or `{ company: null }` |

## Applications / ATS

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/applications` | ✓ (scoped by role) | Candidate: own applications. Employer: applications to their jobs (optional `?status=`). Admin: all. |
| GET | `/api/applications/:id` | ✓ | Full detail incl. `notes` and `history` |
| PUT | `/api/applications/:id/status` | employer (owner), admin | `{ status, note? }`. Tracks `candidate_shortlisted`/`offer_sent`/`hire_completed` events. |
| POST | `/api/applications/:id/withdraw` | job_seeker (owner) | |
| POST | `/api/applications/:id/notes` | employer (owner), admin | `{ note }` |
| PUT | `/api/applications/:id/rate` | employer (owner), admin | `{ rating: 1-5 }` |

## Interviews

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/interviews` | employer (owner), admin | `{ applicationId, type, scheduledAt, locationOrLink?, notes? }`. Moves the application to `interview` status and tracks `interview_scheduled`. |
| GET | `/api/interviews` | ✓ | Candidate's or employer's interviews |

## Messaging

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/conversations` | ✓ | `{ applicationId }` — creates/returns the conversation between that application's candidate and employer |
| GET | `/api/conversations` | ✓ | List, enriched with `other_party_name`/`other_party_photo` |
| GET/POST | `/api/conversations/:id/messages` | ✓ (participants only) | |

## Notifications

| Method | Path | Auth |
|---|---|---|
| GET | `/api/notifications` | ✓ |
| POST | `/api/notifications/:id/read` | ✓ |
| POST | `/api/notifications/read-all` | ✓ |

## Reports

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/reports` | ✓ | `{ targetType: job\|company\|user\|message, targetId, reason, details? }` |

## Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | admin | Platform totals |
| GET | `/api/admin/analytics?days=30` | admin | Real event counts by type, daily signups, daily applications — computed from `analytics_events`/`users`/`applications`, never invented |
| GET | `/api/admin/users?role=` | admin | |
| POST | `/api/admin/users/:id/suspend` \| `/restore` | admin | |
| DELETE | `/api/admin/users/:id` | admin | Soft delete |
| GET | `/api/admin/companies/pending` | admin | |
| POST | `/api/admin/companies/:id/approve` \| `/reject` | admin | Approve also sets `verified = true` |
| GET | `/api/admin/reports` | admin | |
| POST | `/api/admin/reports/:id/resolve` | admin | `{ action: "reviewed"\|"dismissed" }` |
| GET | `/api/admin/logs` | admin | Audit log of every admin action above |

## Reference data

`GET /api/industries`, `GET /api/job-categories`, `GET /api/skills`.

## Health

`GET /api/health` → `{ status: "ok", db: "connected" }` (checks a real DB
query, not a hardcoded response).

## Errors

All errors are `{ error: string }` with an appropriate status code (400
validation, 401 unauthenticated, 403 unauthorized, 404 not found, 429 rate
limited, 500 unexpected, 503 health check failure).
