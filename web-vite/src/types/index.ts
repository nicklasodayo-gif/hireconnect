export type Role = "job_seeker" | "employer" | "admin";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "attachment" | "graduate_trainee" | "freelance" | "temporary";
export type WorkMode = "remote" | "hybrid" | "onsite";
export type ExperienceLevel = "entry" | "mid" | "senior" | "executive";
export type EducationLevel = "" | "certificate" | "diploma" | "bachelor" | "master" | "phd";
export type JobStatus = "draft" | "published" | "paused" | "closed";
export type ApplicationStatus = "applied" | "screening" | "shortlisted" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";
export type InterviewType = "video" | "phone" | "physical" | "technical" | "hr" | "panel";

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  emailVerified?: boolean;
}

export interface Skill { name: string; required?: number; level?: string; id?: number }
export interface EducationEntry { id: number; institution: string; degree: string; field?: string | null; start_year?: number | null; end_year?: number | null }
export interface ExperienceEntry { id: number; company: string; title: string; start_date?: string | null; end_date?: string | null; is_current?: number; description?: string | null }

export interface CandidateProfile {
  id: number;
  user_id: number;
  full_name: string;
  photo_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
  years_experience?: number;
  preferred_job_type?: string | null;
  preferred_location?: string | null;
  preferred_work_mode?: string | null;
  expected_salary_min?: number | null;
  expected_salary_max?: number | null;
  availability?: string | null;
  career_interests?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  cv_path?: string | null;
  profile_completion: number;
  skills: Skill[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  certifications: unknown[];
  languages: unknown[];
  missing: string[];
}

export interface Company {
  id: number;
  owner_user_id?: number;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  industry_id?: number | null;
  website?: string | null;
  location?: string | null;
  size?: string | null;
  founded_year?: number | null;
  culture?: string | null;
  benefits?: string | null;
  verified: number;
  status: "pending" | "approved" | "rejected" | "suspended";
  created_at?: string;
  openJobs?: Job[];
}

export interface Job {
  id: number;
  company_id: number;
  category_id?: number | null;
  title: string;
  department?: string | null;
  description: string;
  responsibilities?: string | null;
  requirements?: string | null;
  experience_level: ExperienceLevel;
  education_requirement?: EducationLevel | null;
  employment_type: EmploymentType;
  work_mode: WorkMode;
  location?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string;
  benefits?: string | null;
  openings?: number;
  application_deadline?: string | null;
  status: JobStatus;
  views?: number;
  created_at: string;
  company_name?: string;
  company_logo?: string | null;
  skills?: Skill[];
  matchScore?: number;
}

export interface MatchComponent { score: number; label: string }
export interface MatchResult {
  overall: number;
  skills: MatchComponent & { matched: string[]; missing: string[]; total: number };
  experience: MatchComponent;
  location: MatchComponent;
  education: MatchComponent;
  salary: MatchComponent;
  jobType: MatchComponent;
  reasons: string[];
}

export interface Application {
  id: number;
  job_id: number;
  candidate_id: number;
  status: ApplicationStatus;
  match_score?: number | null;
  cover_note?: string | null;
  cv_path?: string | null;
  rating?: number | null;
  applied_at: string;
  updated_at?: string;
  job_title?: string;
  company_name?: string;
  candidate_name?: string;
  candidate_photo?: string | null;
  candidate_profile_id?: number;
  company_id?: number;
  notes?: ApplicationNote[];
  history?: ApplicationHistoryEntry[];
}
export interface ApplicationNote { id: number; application_id: number; author_id: number; note: string; created_at: string }
export interface ApplicationHistoryEntry { id: number; application_id: number; status: ApplicationStatus; note?: string | null; created_at: string }

export interface Interview {
  id: number;
  application_id: number;
  scheduled_by: number;
  scheduled_at: string;
  type: InterviewType;
  location_or_link?: string | null;
  notes?: string | null;
  status: "scheduled" | "completed" | "cancelled";
  job_id?: number;
  job_title?: string;
  candidate_name?: string;
}

export interface Conversation {
  id: number;
  application_id?: number | null;
  candidate_user_id: number;
  employer_user_id: number;
  created_at: string;
  candidate_name?: string;
  employer_name?: string;
  other_party_name?: string;
  other_party_photo?: string | null;
}
export interface Message { id: number; conversation_id: number; sender_id: number; body: string; attachment_path?: string | null; read_at?: string | null; created_at: string }

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body?: string | null;
  data_json?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface EmployerDashboardStats {
  activeJobs: number;
  totalApplications: number;
  shortlisted: number;
  interviews: number;
  hires: number;
  qualifiedApplicants: number;
  offers: number;
  profileViews: number;
}

export interface AdminStats {
  totalUsers: number;
  jobSeekers: number;
  employers: number;
  activeJobs: number;
  applications: number;
  interviews: number;
  hires: number;
  reportedContent: number;
  pendingCompanies: number;
}

export interface AdminUser { id: number; email: string; role: Role; status: "active" | "suspended"; email_verified: number; created_at: string }
export interface Report { id: number; reporter_id: number; target_type: string; target_id: number; reason: string; details?: string | null; status: "pending" | "reviewed" | "dismissed"; created_at: string }
export interface AdminLogEntry { id: number; admin_id: number; action: string; target_type?: string | null; target_id?: number | null; created_at: string }

export interface AnalyticsSummary {
  windowDays: number;
  eventsByType: { event_type: string; count: number }[];
  dailySignups: { day: string; count: number }[];
  dailyApplications: { day: string; count: number }[];
}

export interface PagedJobs { jobs: Job[]; page: number; pageSize: number; total: number }
export interface PagedCompanies { companies: Company[]; page: number; pageSize: number }
