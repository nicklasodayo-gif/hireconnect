window.getToken = () => localStorage.getItem("hc_token");
window.setToken = (t) => t ? localStorage.setItem("hc_token", t) : localStorage.removeItem("hc_token");
window.getStoredUser = () => { try { return JSON.parse(localStorage.getItem("hc_user")); } catch { return null; } };
window.setStoredUser = (u) => u ? localStorage.setItem("hc_user", JSON.stringify(u)) : localStorage.removeItem("hc_user");

async function request(path, opts = {}) {
  const token = window.getToken();
  const res = await fetch(window.API_BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

window.api = {
  register: (body) => request("/api/auth/register", { method: "POST", body }),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
  forgotPassword: (body) => request("/api/auth/forgot-password", { method: "POST", body }),
  resetPassword: (body) => request("/api/auth/reset-password", { method: "POST", body }),

  myProfile: () => request("/api/candidates/me"),
  updateProfile: (body) => request("/api/candidates/me", { method: "PUT", body }),
  addSkill: (body) => request("/api/candidates/me/skills", { method: "POST", body }),
  addEducation: (body) => request("/api/candidates/me/education", { method: "POST", body }),
  addExperience: (body) => request("/api/candidates/me/experience", { method: "POST", body }),
  uploadCv: (body) => request("/api/candidates/me/cv", { method: "POST", body }),
  candidate: (id) => request(`/api/candidates/${id}`),

  companies: (page = 1) => request(`/api/companies?page=${page}`),
  company: (id) => request(`/api/companies/${id}`),
  createCompany: (body) => request("/api/companies", { method: "POST", body }),
  updateCompany: (id, body) => request(`/api/companies/${id}`, { method: "PUT", body }),
  followCompany: (id) => request(`/api/companies/${id}/follow`, { method: "POST" }),

  jobs: (params = {}) => request(`/api/jobs?${new URLSearchParams(params).toString()}`),
  job: (id) => request(`/api/jobs/${id}`),
  jobMatch: (id) => request(`/api/jobs/${id}/match`),
  recommendedJobs: () => request("/api/jobs/recommended"),
  createJob: (body) => request("/api/jobs", { method: "POST", body }),
  updateJob: (id, body) => request(`/api/jobs/${id}`, { method: "PUT", body }),
  publishJob: (id) => request(`/api/jobs/${id}/publish`, { method: "POST" }),
  pauseJob: (id) => request(`/api/jobs/${id}/pause`, { method: "POST" }),
  closeJob: (id) => request(`/api/jobs/${id}/close`, { method: "POST" }),
  duplicateJob: (id) => request(`/api/jobs/${id}/duplicate`, { method: "POST" }),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: "DELETE" }),
  saveJob: (id) => request(`/api/jobs/${id}/save`, { method: "POST" }),
  unsaveJob: (id) => request(`/api/jobs/${id}/save`, { method: "DELETE" }),
  savedJobs: () => request("/api/saved-jobs"),
  applyToJob: (id, body) => request(`/api/jobs/${id}/apply`, { method: "POST", body }),

  employerJobs: () => request("/api/employers/me/jobs"),
  employerDashboard: () => request("/api/employers/me/dashboard"),

  applications: (status) => request(`/api/applications${status ? `?status=${status}` : ""}`),
  application: (id) => request(`/api/applications/${id}`),
  setApplicationStatus: (id, body) => request(`/api/applications/${id}/status`, { method: "PUT", body }),
  withdrawApplication: (id) => request(`/api/applications/${id}/withdraw`, { method: "POST" }),
  addApplicationNote: (id, body) => request(`/api/applications/${id}/notes`, { method: "POST", body }),
  rateApplication: (id, body) => request(`/api/applications/${id}/rate`, { method: "PUT", body }),

  createInterview: (body) => request("/api/interviews", { method: "POST", body }),
  interviews: () => request("/api/interviews"),

  conversations: () => request("/api/conversations"),
  startConversation: (applicationId) => request("/api/conversations", { method: "POST", body: { applicationId } }),
  messages: (conversationId) => request(`/api/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body) => request(`/api/conversations/${conversationId}/messages`, { method: "POST", body }),

  notifications: () => request("/api/notifications"),
  markNotificationRead: (id) => request(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/api/notifications/read-all", { method: "POST" }),

  report: (body) => request("/api/reports", { method: "POST", body }),

  adminStats: () => request("/api/admin/stats"),
  adminUsers: (role) => request(`/api/admin/users${role ? `?role=${role}` : ""}`),
  suspendUser: (id) => request(`/api/admin/users/${id}/suspend`, { method: "POST" }),
  restoreUser: (id) => request(`/api/admin/users/${id}/restore`, { method: "POST" }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
  pendingCompanies: () => request("/api/admin/companies/pending"),
  approveCompany: (id) => request(`/api/admin/companies/${id}/approve`, { method: "POST" }),
  rejectCompany: (id) => request(`/api/admin/companies/${id}/reject`, { method: "POST" }),
  adminReports: () => request("/api/admin/reports"),
  resolveReport: (id, action) => request(`/api/admin/reports/${id}/resolve`, { method: "POST", body: { action } }),
  adminLogs: () => request("/api/admin/logs"),

  skills: () => request("/api/skills")
};
