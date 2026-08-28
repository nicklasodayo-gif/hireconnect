function parseRoute(hash) {
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  return { segments, query };
}

function Router() {
  const hash = window.useHashRoute();
  const { user, loading } = window.useAuth();
  const { segments, query } = parseRoute(hash);

  if (loading) return <div className="page-shell"><Spinner /></div>;

  const [root, sub, subId, subSub] = segments;

  if (!root) return <window.Landing />;
  if (root === "login") return <window.Login />;
  if (root === "register") return <window.Register />;
  if (root === "jobs") return subId === undefined && !sub ? <window.JobSearch /> : <window.JobDetail id={sub} />;
  if (root === "companies") return sub ? <window.CompanyDetail id={sub} /> : <window.CompaniesList />;

  if (root === "dashboard") return <window.RequireRole role="job_seeker" user={user}><window.CandidateDashboard /></window.RequireRole>;
  if (root === "profile") return <window.RequireRole role="job_seeker" user={user}><window.ProfileEdit /></window.RequireRole>;
  if (root === "applications") return <window.RequireRole role="job_seeker" user={user}><window.ApplicationsTracker /></window.RequireRole>;
  if (root === "saved") return <window.RequireRole role="job_seeker" user={user}><window.SavedJobs /></window.RequireRole>;
  if (root === "notifications") return <window.RequireRole role={["job_seeker", "employer", "admin"]} user={user}><window.Notifications /></window.RequireRole>;
  if (root === "messages") return <window.RequireRole role={["job_seeker", "employer"]} user={user}><window.Messages /></window.RequireRole>;

  if (root === "employer") {
    if (!sub) return <window.RequireRole role="employer" user={user}><window.EmployerDashboard /></window.RequireRole>;
    if (sub === "company") return <window.RequireRole role="employer" user={user}><window.CompanyForm /></window.RequireRole>;
    if (sub === "jobs" && subId === "new") return <window.RequireRole role="employer" user={user}><window.JobPostingForm /></window.RequireRole>;
    if (sub === "jobs" && subId && subSub === "edit") return <window.RequireRole role="employer" user={user}><window.JobPostingForm jobId={subId} /></window.RequireRole>;
    if (sub === "jobs") return <window.RequireRole role="employer" user={user}><window.EmployerJobsList /></window.RequireRole>;
    if (sub === "ats") return <window.RequireRole role="employer" user={user}><window.ATSBoard /></window.RequireRole>;
  }

  if (root === "admin") return <window.RequireRole role="admin" user={user}><window.AdminDashboard /></window.RequireRole>;

  return <window.EmptyState icon="🧭" title="Page not found" body="That page doesn't exist." action={<a className="btn primary" href="#/">Go home</a>} />;
}

function App() {
  return (
    <window.AuthProvider>
      <window.Navbar />
      <main><Router /></main>
      <window.Footer />
      <window.ToastHost />
    </window.AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
