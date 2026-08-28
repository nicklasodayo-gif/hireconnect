-- HireConnect database schema (SQLite dialect; portable to Postgres with minor
-- type changes — see docs/ARCHITECTURE.md "Scaling to Postgres").
-- All tables use INTEGER PRIMARY KEY (rowid alias) for ids, TEXT timestamps
-- (ISO-8601), and soft deletes via deleted_at where the spec calls for them.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('job_seeker','employer','admin')),
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE industries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE job_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE skills (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT
);

CREATE TABLE candidate_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  headline TEXT,
  bio TEXT,
  location TEXT,
  phone TEXT,
  years_experience REAL DEFAULT 0,
  preferred_job_type TEXT,          -- full_time | part_time | contract | internship
  preferred_location TEXT,
  preferred_work_mode TEXT,         -- remote | hybrid | onsite
  expected_salary_min INTEGER,
  expected_salary_max INTEGER,
  currency TEXT DEFAULT 'KES',
  availability TEXT,                -- immediate | 2_weeks | 1_month | negotiable
  career_interests TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  cv_path TEXT,
  profile_completion INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE candidate_languages (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  proficiency TEXT NOT NULL DEFAULT 'conversational'
);

CREATE TABLE education (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field TEXT,
  start_year INTEGER,
  end_year INTEGER
);

CREATE TABLE experience (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  description TEXT
);

CREATE TABLE certifications (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  year INTEGER
);

CREATE TABLE candidate_skills (
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'intermediate',
  PRIMARY KEY (candidate_id, skill_id)
);

CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  industry_id INTEGER REFERENCES industries(id),
  website TEXT,
  location TEXT,
  size TEXT,               -- '1-10','11-50','51-200','201-500','500+'
  founded_year INTEGER,
  culture TEXT,
  benefits TEXT,
  social_links TEXT,       -- JSON string
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_companies_owner ON companies(owner_user_id);

CREATE TABLE employer_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  job_title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES job_categories(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  department TEXT,
  description TEXT NOT NULL,
  responsibilities TEXT,
  requirements TEXT,
  experience_level TEXT,        -- entry | mid | senior | executive
  education_requirement TEXT,
  employment_type TEXT NOT NULL,-- full_time | part_time | contract | internship | attachment | graduate_trainee | freelance | temporary
  work_mode TEXT NOT NULL,      -- remote | hybrid | onsite
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'KES',
  benefits TEXT,
  openings INTEGER NOT NULL DEFAULT 1,
  application_deadline TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','closed')),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_category ON jobs(category_id);

CREATE TABLE job_skills (
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN
    ('applied','screening','shortlisted','interview','offer','hired','rejected','withdrawn')),
  match_score INTEGER,
  cover_note TEXT,
  cv_path TEXT,
  rating INTEGER,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);

CREATE TABLE application_status_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE application_notes (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_jobs (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (candidate_id, job_id)
);

CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name TEXT,
  query_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE followed_companies (
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (candidate_id, company_id)
);

CREATE TABLE interviews (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_by INTEGER NOT NULL REFERENCES users(id),
  scheduled_at TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video','phone','physical','technical','hr','panel')),
  location_or_link TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_interviews_application ON interviews(application_id);

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
  candidate_user_id INTEGER NOT NULL REFERENCES users(id),
  employer_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (candidate_user_id, employer_user_id, application_id)
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  attachment_path TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data_json TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id INTEGER NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
  id INTEGER PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('job','company','user','message')),
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE admin_logs (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Analytics events (Phase 25). Real events emitted from server/src/app.ts
-- as they happen (job_view, job_save, job_apply, profile_view,
-- company_view, search, candidate_shortlisted, interview_scheduled,
-- offer_sent, hire_completed) — never backfilled or invented, per Rule 3/4.
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, created_at);

