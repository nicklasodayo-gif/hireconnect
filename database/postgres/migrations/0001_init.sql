-- HireConnect — PostgreSQL migration 0001: initial schema
--
-- Translated from docs/SCHEMA.sql (the SQLite schema the app currently
-- runs against). Differences from the SQLite version, deliberate and
-- documented rather than accidental:
--   - INTEGER PRIMARY KEY (SQLite rowid alias) -> BIGSERIAL PRIMARY KEY
--   - TEXT timestamp columns with datetime('now') -> TIMESTAMPTZ DEFAULT now()
--   - 0/1 "boolean" INTEGER columns -> native BOOLEAN
--   - PRAGMA foreign_keys is SQLite-only; Postgres enforces FKs by default.
--
-- Run with: psql "$DATABASE_URL" -f database/postgres/migrations/0001_init.sql
-- This migration is intentionally idempotent-safe on a fresh database only
-- (no IF NOT EXISTS on CREATE TABLE) — see database/postgres/README.md for
-- how migration 0002+ should be structured once this ships to a live DB.

BEGIN;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('job_seeker','employer','admin')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE industries (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE job_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE skills (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT
);

CREATE TABLE candidate_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  headline TEXT,
  bio TEXT,
  location TEXT,
  phone TEXT,
  years_experience NUMERIC DEFAULT 0,
  preferred_job_type TEXT,
  preferred_location TEXT,
  preferred_work_mode TEXT,
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  currency TEXT DEFAULT 'KES',
  availability TEXT,
  career_interests TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  cv_path TEXT,
  profile_completion INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE candidate_languages (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  proficiency TEXT NOT NULL DEFAULT 'conversational'
);

CREATE TABLE education (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field TEXT,
  start_year INTEGER,
  end_year INTEGER
);

CREATE TABLE experience (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);

CREATE TABLE certifications (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  year INTEGER
);

CREATE TABLE candidate_skills (
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'intermediate',
  PRIMARY KEY (candidate_id, skill_id)
);

CREATE TABLE companies (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  industry_id BIGINT REFERENCES industries(id),
  website TEXT,
  location TEXT,
  size TEXT,
  founded_year INTEGER,
  culture TEXT,
  benefits TEXT,
  social_links JSONB,
  verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_companies_owner ON companies(owner_user_id);

CREATE TABLE employer_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  job_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES job_categories(id),
  created_by BIGINT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  department TEXT,
  description TEXT NOT NULL,
  responsibilities TEXT,
  requirements TEXT,
  experience_level TEXT,
  education_requirement TEXT,
  employment_type TEXT NOT NULL,
  work_mode TEXT NOT NULL,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'KES',
  benefits TEXT,
  openings INTEGER NOT NULL DEFAULT 1,
  application_deadline DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed')),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category ON jobs(category_id);
-- Full-text search over title/description — a genuine Postgres upgrade
-- over the SQLite version's `LIKE '%...%'` scan.
CREATE INDEX idx_jobs_search ON jobs USING GIN (to_tsvector('english', title || ' ' || description));

CREATE TABLE job_skills (
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN
    ('applied','screening','shortlisted','interview','offer','hired','rejected','withdrawn')),
  match_score INTEGER,
  cover_note TEXT,
  cv_path TEXT,
  rating INTEGER,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);

CREATE TABLE application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE application_notes (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE saved_jobs (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE saved_searches (
  id BIGSERIAL PRIMARY KEY,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name TEXT,
  query_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE followed_companies (
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, company_id)
);

CREATE TABLE interviews (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_by BIGINT NOT NULL REFERENCES users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video','phone','physical','technical','hr','panel')),
  location_or_link TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interviews_application ON interviews(application_id);

CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT REFERENCES applications(id) ON DELETE SET NULL,
  candidate_user_id BIGINT NOT NULL REFERENCES users(id),
  employer_user_id BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_user_id, employer_user_id, application_id)
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  attachment_path TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data_json JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE reviews (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id BIGINT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('job','company','user','message')),
  target_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id BIGINT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics events (Phase 25) — not yet emitted by the application code,
-- but the table is here so that work can start without a further schema
-- migration. See UPGRADE_PLAN.md Checkpoint D.
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id BIGINT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, created_at);

COMMIT;
