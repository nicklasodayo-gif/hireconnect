# Email templates

None of these are wired to a real provider yet (see README "Known gaps").
The API already generates the right tokens/events at the right moments
(registration, status changes, interview scheduling, password reset) — an
`EmailService` interface just needs to be dropped in at the points marked
below in `server/src/app.ts`, then swapped between SMTP/Resend/SendGrid via
`EMAIL_PROVIDER` in `.env`.

## Welcome
Trigger: `POST /api/auth/register`
Subject: Welcome to HireConnect, {{firstName}}!
Body: Confirms account type (job seeker/employer), links to complete profile.

## Email verification
Trigger: `POST /api/auth/register` (token already generated as `verification_token`)
Subject: Verify your HireConnect email
Body: Link containing the token, consumed by `POST /api/auth/verify-email`.

## Application submitted
Trigger: `POST /api/jobs/:id/apply`
Subject: Your application for {{jobTitle}} was submitted
Body: Confirms submission, links to the application tracker.

## Application status update
Trigger: `PUT /api/applications/:id/status`
Subject: Update on your application for {{jobTitle}}
Body: New status, and a note if the employer left one.

## Interview invitation
Trigger: `POST /api/interviews`
Subject: Interview scheduled: {{jobTitle}} at {{companyName}}
Body: Date/time, type, location or link.

## Interview reminder
Trigger: scheduled job (not yet implemented) checking `interviews.scheduled_at`
within the next 24h.

## Password reset
Trigger: `POST /api/auth/forgot-password` (token already generated)
Subject: Reset your HireConnect password
Body: Link containing the token, consumed by `POST /api/auth/reset-password`.
Expires in 30 minutes.

## New applicant notification (employer)
Trigger: `POST /api/jobs/:id/apply`
Subject: New applicant for {{jobTitle}}
Body: Candidate name, match score, link to the ATS pipeline.
