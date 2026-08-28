import { useAuth } from "@/context/AuthContext";
import { useHashRoute, parseRoute } from "@/hooks/useHashRoute";
import { Spinner, EmptyState } from "@/components/ui";
import { RequireRole } from "@/components/layout/RequireRole";

import { Landing } from "@/pages/Landing";
import { Login, Register } from "@/pages/Auth";
import { JobSearch } from "@/pages/JobSearch";
import { JobDetail } from "@/pages/JobDetail";
import { CompaniesList, CompanyDetail } from "@/pages/Companies";

import { CandidateDashboard } from "@/pages/candidate/Dashboard";
import { ProfileEdit } from "@/pages/candidate/ProfileEdit";
import { ApplicationsTracker } from "@/pages/candidate/ApplicationsTracker";
import { SavedJobs } from "@/pages/candidate/SavedJobs";
import { Notifications } from "@/pages/candidate/Notifications";
import { Messages } from "@/pages/candidate/Messages";

import { EmployerDashboard } from "@/pages/employer/Dashboard";
import { CompanyForm } from "@/pages/employer/CompanyForm";
import { JobPostingForm } from "@/pages/employer/JobPostingForm";
import { EmployerJobsList } from "@/pages/employer/JobsList";
import { ATSBoard } from "@/pages/employer/ATSBoard";
import { CandidateProfileView } from "@/pages/employer/CandidateProfileView";

import { AdminDashboard } from "@/pages/admin/AdminDashboard";

export function Router() {
  const hash = useHashRoute();
  const { loading } = useAuth();
  const { segments } = parseRoute(hash);
  const [root, sub, subId, subSub] = segments;

  if (loading) return <div className="page-shell"><Spinner /></div>;

  if (!root) return <Landing />;
  if (root === "login") return <Login />;
  if (root === "register") return <Register />;
  if (root === "jobs") return !sub ? <JobSearch /> : <JobDetail id={sub} />;
  if (root === "companies") return sub ? <CompanyDetail id={sub} /> : <CompaniesList />;

  if (root === "dashboard") return <RequireRole role="job_seeker"><CandidateDashboard /></RequireRole>;
  if (root === "profile") return <RequireRole role="job_seeker"><ProfileEdit /></RequireRole>;
  if (root === "applications") return <RequireRole role="job_seeker"><ApplicationsTracker /></RequireRole>;
  if (root === "saved") return <RequireRole role="job_seeker"><SavedJobs /></RequireRole>;
  if (root === "notifications") return <RequireRole role={["job_seeker", "employer", "admin"]}><Notifications /></RequireRole>;
  if (root === "messages") return <RequireRole role={["job_seeker", "employer"]}><Messages /></RequireRole>;

  if (root === "employer") {
    if (!sub) return <RequireRole role="employer"><EmployerDashboard /></RequireRole>;
    if (sub === "company") return <RequireRole role="employer"><CompanyForm /></RequireRole>;
    if (sub === "messages") return <RequireRole role="employer"><Messages /></RequireRole>;
    if (sub === "candidates" && subId) return <RequireRole role={["employer", "admin"]}><CandidateProfileView id={subId} /></RequireRole>;
    if (sub === "jobs" && subId === "new") return <RequireRole role="employer"><JobPostingForm /></RequireRole>;
    if (sub === "jobs" && subId && subSub === "edit") return <RequireRole role="employer"><JobPostingForm jobId={subId} /></RequireRole>;
    if (sub === "jobs") return <RequireRole role="employer"><EmployerJobsList /></RequireRole>;
    if (sub === "ats") return <RequireRole role="employer"><ATSBoard /></RequireRole>;
  }

  if (root === "admin") return <RequireRole role="admin"><AdminDashboard /></RequireRole>;

  return <EmptyState icon="🧭" title="Page not found" body="That page doesn't exist." action={<a className="btn primary" href="#/">Go home</a>} />;
}
