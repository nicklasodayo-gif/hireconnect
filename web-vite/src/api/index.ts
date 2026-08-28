import { request } from "./client";
import type {
  AdminLogEntry, AdminStats, AdminUser, Application, AnalyticsSummary, AuthUser, CandidateProfile, Company,
  Conversation, EmployerDashboardStats, Interview, Job, MatchResult, Message, Notification,
  PagedCompanies, PagedJobs, Report
} from "@/types";

export interface RegisterInput { email: string; password: string; role: "job_seeker" | "employer"; fullName?: string; companyName?: string }
export interface LoginResult { token: string; user: AuthUser }

export const authApi = {
  register: (body: RegisterInput) => request<{ message: string; devVerificationToken?: string }>("/api/auth/register", { method: "POST", body }),
  login: (email: string, password: string) => request<LoginResult>("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
  me: () => request<AuthUser>("/api/auth/me"),
  forgotPassword: (email: string) => request<{ message: string; devResetToken?: string }>("/api/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token: string, password: string) => request<{ message: string }>("/api/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token: string) => request<{ message: string }>("/api/auth/verify-email", { method: "POST", body: { token } })
};

export interface ProfileUpdateInput {
  fullName?: string; headline?: string; bio?: string; location?: string; phone?: string;
  yearsExperience?: number; preferredJobType?: string; preferredLocation?: string; preferredWorkMode?: string;
  expectedSalaryMin?: number; expectedSalaryMax?: number; availability?: string; careerInterests?: string;
  linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string;
}

export const candidateApi = {
  myProfile: () => request<CandidateProfile>("/api/candidates/me"),
  updateProfile: (body: ProfileUpdateInput) => request<CandidateProfile>("/api/candidates/me", { method: "PUT", body }),
  addSkill: (name: string, level?: string) => request<CandidateProfile>("/api/candidates/me/skills", { method: "POST", body: { name, level } }),
  addEducation: (body: { institution: string; degree: string; field?: string; startYear?: string; endYear?: string }) =>
    request<CandidateProfile>("/api/candidates/me/education", { method: "POST", body }),
  addExperience: (body: { company: string; title: string; startDate?: string; endDate?: string; isCurrent?: boolean; description?: string }) =>
    request<CandidateProfile>("/api/candidates/me/experience", { method: "POST", body }),
  uploadCv: (fileName: string, base64: string) => request<{ message: string; cvId: string }>("/api/candidates/me/cv", { method: "POST", body: { fileName, base64 } }),
  get: (id: number | string) => request<CandidateProfile>(`/api/candidates/${id}`)
};

export const companyApi = {
  list: (page = 1) => request<PagedCompanies>(`/api/companies?page=${page}`),
  get: (id: number | string) => request<Company>(`/api/companies/${id}`),
  create: (body: Partial<Company>) => request<Company>("/api/companies", { method: "POST", body }),
  update: (id: number | string, body: Partial<Company>) => request<Company>(`/api/companies/${id}`, { method: "PUT", body }),
  follow: (id: number | string) => request<{ message: string }>(`/api/companies/${id}/follow`, { method: "POST" })
};

export interface JobSearchParams {
  q?: string; location?: string; employmentType?: string; workMode?: string; experienceLevel?: string;
  minSalary?: string; companyId?: string; sort?: string; page?: string;
}
export interface JobCreateInput {
  title: string; department?: string; description: string; responsibilities?: string; requirements?: string;
  experienceLevel?: string; educationRequirement?: string; employmentType: string; workMode: string; location?: string;
  salaryMin?: number | string; salaryMax?: number | string; benefits?: string; openings?: number | string;
  applicationDeadline?: string; skills?: string[]; status?: "draft" | "published";
}

export const jobApi = {
  search: (params: JobSearchParams = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return request<PagedJobs>(`/api/jobs?${query}`);
  },
  get: (id: number | string) => request<Job>(`/api/jobs/${id}`),
  match: (id: number | string) => request<MatchResult>(`/api/jobs/${id}/match`),
  recommended: () => request<{ jobs: Job[] }>("/api/jobs/recommended"),
  create: (body: JobCreateInput) => request<Job>("/api/jobs", { method: "POST", body }),
  update: (id: number | string, body: Partial<JobCreateInput>) => request<Job>(`/api/jobs/${id}`, { method: "PUT", body }),
  publish: (id: number | string) => request<Job>(`/api/jobs/${id}/publish`, { method: "POST" }),
  pause: (id: number | string) => request<Job>(`/api/jobs/${id}/pause`, { method: "POST" }),
  close: (id: number | string) => request<Job>(`/api/jobs/${id}/close`, { method: "POST" }),
  duplicate: (id: number | string) => request<Job>(`/api/jobs/${id}/duplicate`, { method: "POST" }),
  remove: (id: number | string) => request<{ message: string }>(`/api/jobs/${id}`, { method: "DELETE" }),
  save: (id: number | string) => request<{ message: string }>(`/api/jobs/${id}/save`, { method: "POST" }),
  unsave: (id: number | string) => request<{ message: string }>(`/api/jobs/${id}/save`, { method: "DELETE" }),
  saved: () => request<{ jobs: Job[] }>("/api/saved-jobs"),
  apply: (id: number | string, coverNote?: string) => request<Application>(`/api/jobs/${id}/apply`, { method: "POST", body: { coverNote } })
};

export interface SavedSearch { id: number; candidate_id: number; name?: string | null; query: JobSearchParams; created_at: string }

export const savedSearchApi = {
  list: () => request<{ searches: SavedSearch[] }>("/api/saved-searches"),
  create: (name: string | undefined, query: JobSearchParams) => request<SavedSearch>("/api/saved-searches", { method: "POST", body: { name, query } }),
  remove: (id: number | string) => request<{ message: string }>(`/api/saved-searches/${id}`, { method: "DELETE" })
};

export const employerApi = {
  myJobs: () => request<{ jobs: Job[] }>("/api/employers/me/jobs"),
  dashboard: () => request<EmployerDashboardStats>("/api/employers/me/dashboard"),
  myCompany: () => request<{ company: Company | null }>("/api/employers/me/company")
};

export const applicationApi = {
  list: (status?: string) => request<{ applications: Application[] }>(`/api/applications${status ? `?status=${status}` : ""}`),
  get: (id: number | string) => request<Application>(`/api/applications/${id}`),
  setStatus: (id: number | string, status: string) => request<Application>(`/api/applications/${id}/status`, { method: "PUT", body: { status } }),
  withdraw: (id: number | string) => request<{ message: string }>(`/api/applications/${id}/withdraw`, { method: "POST" }),
  addNote: (id: number | string, note: string) => request<{ message: string }>(`/api/applications/${id}/notes`, { method: "POST", body: { note } }),
  rate: (id: number | string, rating: number) => request<{ message: string }>(`/api/applications/${id}/rate`, { method: "PUT", body: { rating } })
};

export const interviewApi = {
  create: (body: { applicationId: number; type: string; scheduledAt: string; locationOrLink?: string; notes?: string }) =>
    request<Interview>("/api/interviews", { method: "POST", body }),
  list: () => request<{ interviews: Interview[] }>("/api/interviews")
};

export const messageApi = {
  conversations: () => request<{ conversations: Conversation[] }>("/api/conversations"),
  start: (applicationId: number | string) => request<Conversation>("/api/conversations", { method: "POST", body: { applicationId } }),
  messages: (conversationId: number | string) => request<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`),
  send: (conversationId: number | string, body: string) => request<Message>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: { body } })
};

export const notificationApi = {
  list: () => request<{ notifications: Notification[] }>("/api/notifications"),
  markRead: (id: number | string) => request<{ message: string }>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<{ message: string }>("/api/notifications/read-all", { method: "POST" })
};

export const reportApi = {
  submit: (body: { targetType: string; targetId: number | string; reason: string; details?: string }) =>
    request<{ message: string }>("/api/reports", { method: "POST", body })
};

export const adminApi = {
  stats: () => request<AdminStats>("/api/admin/stats"),
  analytics: (days = 30) => request<AnalyticsSummary>(`/api/admin/analytics?days=${days}`),
  users: (role?: string) => request<{ users: AdminUser[] }>(`/api/admin/users${role ? `?role=${role}` : ""}`),
  suspendUser: (id: number | string) => request<{ message: string }>(`/api/admin/users/${id}/suspend`, { method: "POST" }),
  restoreUser: (id: number | string) => request<{ message: string }>(`/api/admin/users/${id}/restore`, { method: "POST" }),
  deleteUser: (id: number | string) => request<{ message: string }>(`/api/admin/users/${id}`, { method: "DELETE" }),
  pendingCompanies: () => request<{ companies: Company[] }>("/api/admin/companies/pending"),
  approveCompany: (id: number | string) => request<{ message: string }>(`/api/admin/companies/${id}/approve`, { method: "POST" }),
  rejectCompany: (id: number | string) => request<{ message: string }>(`/api/admin/companies/${id}/reject`, { method: "POST" }),
  reports: () => request<{ reports: Report[] }>("/api/admin/reports"),
  resolveReport: (id: number | string, action: "reviewed" | "dismissed") => request<{ message: string }>(`/api/admin/reports/${id}/resolve`, { method: "POST", body: { action } }),
  logs: () => request<{ logs: AdminLogEntry[] }>("/api/admin/logs")
};

export const referenceApi = {
  industries: () => request<{ industries: { id: number; name: string }[] }>("/api/industries"),
  categories: () => request<{ categories: { id: number; name: string }[] }>("/api/job-categories"),
  skills: () => request<{ skills: { id: number; name: string }[] }>("/api/skills"),
  health: () => request<{ status: string; db: string }>("/api/health")
};
