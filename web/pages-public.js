function HeroVisual() {
  // A small interactive "matching" visual built from SVG/CSS — no stock
  // imagery, and it animates to reflect what the platform actually does.
  return (
    <div className="hero-visual">
      <div className="hv-card hv-candidate"><div className="hv-avatar">👩🏾‍💻</div><div><b>Amina K.</b><small>Backend Engineer</small></div></div>
      <div className="hv-card hv-job"><div className="hv-logo">🏢</div><div><b>Senior Backend Engineer</b><small>Twiga Digital Solutions</small></div></div>
      <svg className="hv-connector" viewBox="0 0 200 80"><path d="M10 20 C 80 20, 80 60, 190 60" /></svg>
      <div className="hv-score">92% <span>Match</span></div>
    </div>
  );
}

function StatStrip() {
  const [stats, setStats] = React.useState(null);
  React.useEffect(() => {
    Promise.all([window.api.jobs({ page: 1 }), window.api.companies(1)])
      .then(([jobs, companies]) => setStats({ jobs: jobs.total, companies: companies.companies.length }))
      .catch(() => {});
  }, []);
  return (
    <div className="stat-strip">
      <div><b>{stats ? `${stats.jobs}+` : "—"}</b><span>Active jobs</span></div>
      <div><b>{stats ? `${stats.companies}+` : "—"}</b><span>Companies hiring</span></div>
      <div><b>KES</b><span>Local salary ranges</span></div>
      <div><b>Nairobi &amp; beyond</b><span>Kenya-wide opportunities</span></div>
    </div>
  );
}

function JobCard({ job, onSave }) {
  return (
    <div className="job-card">
      <div className="job-card-top">
        <div className="company-logo-sm">{job.company_logo ? <img src={job.company_logo} /> : "🏢"}</div>
        <div className="job-card-title"><a href={`#/jobs/${job.id}`}><b>{job.title}</b></a><small>{job.company_name} · {job.location || "Remote"}</small></div>
        <MatchBadge score={job.matchScore} />
      </div>
      <div className="job-card-tags">
        <Badge>{(job.employment_type || "").replace("_", " ")}</Badge>
        <Badge>{job.work_mode}</Badge>
        {job.experience_level && <Badge>{job.experience_level}</Badge>}
      </div>
      <div className="job-card-bottom">
        <span className="salary">{window.formatKES(job.salary_min, job.salary_max)}</span>
        <span className="posted">{window.timeAgo(job.created_at)}</span>
      </div>
      <div className="job-card-actions">
        <a className="btn subtle" href={`#/jobs/${job.id}`}>View details</a>
        {onSave && <button className="btn ghost" onClick={() => onSave(job.id)}>☆ Save</button>}
      </div>
    </div>
  );
}
window.JobCard = JobCard;

function Landing() {
  const [popular, setPopular] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  React.useEffect(() => {
    window.api.jobs({ sort: "newest" }).then((r) => setPopular(r.jobs.slice(0, 6))).catch(() => {});
    window.api.companies(1).then((r) => setCompanies(r.companies.slice(0, 6))).catch(() => {});
  }, []);
  const categories = ["Software Engineering", "Product & Design", "Sales & Marketing", "Finance & Accounting", "Data & Analytics", "Operations & Logistics"];
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">✦ KENYA'S MODERN RECRUITMENT PLATFORM</div>
          <h1>Find Work.<br />Find Talent.<br /><em>Build What's Next.</em></h1>
          <p>HireConnect connects ambitious professionals with companies looking for the right talent — with transparent, explainable job matching.</p>
          <div className="hero-cta">
            <a className="btn primary huge" href="#/jobs">Find Jobs</a>
            <a className="btn ghost huge" href="#/register">Hire Talent</a>
          </div>
        </div>
        <HeroVisual />
      </section>
      <StatStrip />

      <section className="section">
        <div className="section-head"><h2>Popular Jobs</h2><a href="#/jobs">See all jobs →</a></div>
        <div className="job-grid">{popular.map((j) => <JobCard key={j.id} job={j} />)}</div>
      </section>

      <section className="section alt">
        <div className="section-head"><h2>Top Companies Hiring</h2><a href="#/companies">See all companies →</a></div>
        <div className="company-grid">
          {companies.map((c) => (
            <a className="company-card" key={c.id} href={`#/companies/${c.id}`}>
              <div className="company-logo">{c.logo_url ? <img src={c.logo_url} /> : "🏢"}</div>
              <b>{c.name}</b><small>{c.location}</small>
              {!!c.verified && <Badge tone="good">✓ Verified</Badge>}
            </a>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>How HireConnect Works</h2></div>
        <div className="how-grid">
          <div className="how-step"><div className="how-num">01</div><h3>Create your profile</h3><p>Add your skills, experience and preferences once — it powers every match.</p></div>
          <div className="how-step"><div className="how-num">02</div><h3>Get matched</h3><p>See a transparent match score for every job, with a clear breakdown of why.</p></div>
          <div className="how-step"><div className="how-num">03</div><h3>Apply &amp; track</h3><p>Apply in one click and follow your application from submitted to hired.</p></div>
        </div>
      </section>

      <section className="section alt">
        <div className="section-head"><h2>Explore by Category</h2></div>
        <div className="category-grid">
          {categories.map((c) => <a key={c} className="category-chip" href={`#/jobs?category=${encodeURIComponent(c)}`}>{c}</a>)}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Success Stories</h2></div>
        <div className="story-grid">
          <div className="story-card">"I found a backend role in three weeks — the match breakdown told me exactly why I was a fit before I even applied." <b>— Wanjiru M., Software Engineer</b></div>
          <div className="story-card">"As a recruiter, the ATS pipeline saved us hours every week screening candidates." <b>— Otieno A., Talent Lead</b></div>
          <div className="story-card">"HireConnect's salary transparency in KES made negotiating so much easier." <b>— Achieng W., Product Designer</b></div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to build what's next?</h2>
        <div className="hero-cta"><a className="btn primary huge" href="#/register">Get Started Free</a></div>
      </section>
    </div>
  );
}
window.Landing = Landing;

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <a className="brand" href="#/">Hire<span>Connect</span></a>
        <h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

function Login() {
  const { login } = window.useAuth();
  const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const user = await login(email, password);
      window.showToast("Welcome back!", "success");
      window.navigate(user.role === "admin" ? "/admin" : user.role === "employer" ? "/employer" : "/dashboard");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue your job search or hiring.">
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn primary wide" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
      </form>
      <p className="muted small">No account? <a href="#/register">Register</a></p>
    </AuthCard>
  );
}
window.Login = Login;

function Register() {
  const { register, login } = window.useAuth();
  const [role, setRole] = React.useState(null);
  const [form, setForm] = React.useState({ fullName: "", companyName: "", email: "", password: "" });
  const [error, setError] = React.useState(""); const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!role) {
    return (
      <AuthCard title='"How are you using HireConnect?"' subtitle="Choose the option that fits you — you can't change this later.">
        <div className="role-choice">
          <button className="role-card" onClick={() => setRole("job_seeker")}><span>🔎</span><b>I'm looking for a job</b><small>Build a profile and get matched to roles.</small></button>
          <button className="role-card" onClick={() => setRole("employer")}><span>🏢</span><b>I'm hiring</b><small>Post jobs and manage applicants.</small></button>
        </div>
        <p className="muted small">Already have an account? <a href="#/login">Log in</a></p>
      </AuthCard>
    );
  }
  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      await register({ email: form.email, password: form.password, role, fullName: form.fullName, companyName: form.companyName });
      await login(form.email, form.password);
      window.showToast("Account created — let's set up your profile.", "success");
      window.navigate(role === "employer" ? "/employer/company" : "/profile");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <AuthCard title={role === "employer" ? "Create your employer account" : "Create your candidate account"}>
      <form onSubmit={submit}>
        <ErrorBanner error={error} />
        {role === "job_seeker"
          ? <label>Full name<input required value={form.fullName} onChange={set("fullName")} /></label>
          : <label>Company name<input required value={form.companyName} onChange={set("companyName")} /></label>}
        <label>Email<input type="email" required value={form.email} onChange={set("email")} /></label>
        <label>Password<input type="password" required minLength={8} value={form.password} onChange={set("password")} /></label>
        <button className="btn primary wide" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button>
      </form>
      <button className="btn ghost wide" onClick={() => setRole(null)}>← Back</button>
    </AuthCard>
  );
}
window.Register = Register;

function JobSearch() {
  const [jobs, setJobs] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({ q: "", location: "", employmentType: "", workMode: "", experienceLevel: "", sort: "newest" });
  const { user } = window.useAuth();

  const search = React.useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    window.api.jobs(params).then((r) => { setJobs(r.jobs); setTotal(r.total); }).catch(() => window.showToast("Couldn't load jobs.", "error")).finally(() => setLoading(false));
  }, [filters]);
  React.useEffect(() => { search(); }, [search]);

  const save = async (jobId) => {
    if (!user) return window.navigate("/login");
    try { await window.api.saveJob(jobId); window.showToast("Job saved."); } catch (e) { window.showToast(e.message, "error"); }
  };

  return (
    <div className="page-shell">
      <h1>Find your next role</h1>
      <div className="filter-bar">
        <input placeholder="Job title or keyword" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <input placeholder="Location" value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} />
        <select value={filters.employmentType} onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}>
          <option value="">Any type</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option>
        </select>
        <select value={filters.workMode} onChange={(e) => setFilters((f) => ({ ...f, workMode: e.target.value }))}>
          <option value="">Remote/Hybrid/On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
        </select>
        <select value={filters.experienceLevel} onChange={(e) => setFilters((f) => ({ ...f, experienceLevel: e.target.value }))}>
          <option value="">Any experience</option><option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="executive">Executive</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
          <option value="newest">Newest</option><option value="salary">Highest salary</option>
        </select>
      </div>
      <p className="muted">{loading ? "Searching…" : `${total} jobs found`}</p>
      {loading ? <Spinner /> : jobs.length === 0
        ? <EmptyState icon="🔍" title="No jobs match your filters" body="Try widening your search." />
        : <div className="job-grid">{jobs.map((j) => <JobCard key={j.id} job={j} onSave={save} />)}</div>}
    </div>
  );
}
window.JobSearch = JobSearch;

function JobDetail({ id }) {
  const [job, setJob] = React.useState(null);
  const [match, setMatch] = React.useState(null);
  const [applying, setApplying] = React.useState(false);
  const [coverNote, setCoverNote] = React.useState("");
  const { user } = window.useAuth();

  React.useEffect(() => {
    window.api.job(id).then(setJob).catch(() => window.showToast("Job not found.", "error"));
    if (user?.role === "job_seeker") window.api.jobMatch(id).then(setMatch).catch(() => {});
  }, [id, user]);

  if (!job) return <div className="page-shell"><Spinner /></div>;

  const apply = async () => {
    setApplying(true);
    try {
      await window.api.applyToJob(id, { coverNote });
      window.showToast("Application submitted!", "success");
      window.navigate("/applications");
    } catch (e) { window.showToast(e.message, "error"); } finally { setApplying(false); }
  };

  return (
    <div className="page-shell narrow">
      <a className="back-link" href="#/jobs">← Back to search</a>
      <div className="job-detail-head">
        <div className="company-logo-sm">{job.company_logo ? <img src={job.company_logo} /> : "🏢"}</div>
        <div><h1>{job.title}</h1><p className="muted">{job.company_name} · {job.location || "Remote"}</p></div>
        {match && <MatchBadge score={match.overall} />}
      </div>
      <div className="job-detail-tags">
        <Badge>{(job.employment_type || "").replace("_", " ")}</Badge><Badge>{job.work_mode}</Badge>
        <Badge>{job.experience_level}</Badge><Badge tone="good">{window.formatKES(job.salary_min, job.salary_max)}</Badge>
      </div>

      {match && (
        <div className="match-breakdown">
          <h3>Why this job matches you</h3>
          <div className="match-rows">
            {[["Skills", match.skills], ["Experience", match.experience], ["Location", match.location], ["Education", match.education], ["Salary", match.salary], ["Job Type", match.jobType]].map(([label, m]) => (
              <div className="match-row" key={label}><span>{label}</span><ProgressBar value={m.score} tone={m.score >= 70 ? "good" : m.score >= 40 ? "warn" : "bad"} /><small>{m.label}</small></div>
            ))}
          </div>
          {match.reasons.length > 0 && <ul className="match-reasons">{match.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
        </div>
      )}

      <section><h3>Description</h3><p>{job.description}</p></section>
      {job.responsibilities && <section><h3>Responsibilities</h3><p>{job.responsibilities}</p></section>}
      {job.requirements && <section><h3>Requirements</h3><p>{job.requirements}</p></section>}
      {job.skills?.length > 0 && <section><h3>Skills</h3><div className="pill-row">{job.skills.map((s) => <Badge key={s.name}>{s.name}</Badge>)}</div></section>}
      {job.benefits && <section><h3>Benefits</h3><p>{job.benefits}</p></section>}

      {user?.role === "job_seeker" ? (
        <div className="apply-box">
          <textarea placeholder="Optional note to the employer…" value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
          <button className="btn primary huge" onClick={apply} disabled={applying}>{applying ? "Submitting…" : "Apply Now"}</button>
        </div>
      ) : !user ? (
        <div className="apply-box"><a className="btn primary huge" href="#/login">Log in to apply</a></div>
      ) : null}
    </div>
  );
}
window.JobDetail = JobDetail;

function CompaniesList() {
  const [companies, setCompanies] = React.useState([]);
  React.useEffect(() => { window.api.companies(1).then((r) => setCompanies(r.companies)).catch(() => {}); }, []);
  return (
    <div className="page-shell">
      <h1>Discover companies</h1>
      <div className="company-grid">
        {companies.map((c) => (
          <a className="company-card" key={c.id} href={`#/companies/${c.id}`}>
            <div className="company-logo">{c.logo_url ? <img src={c.logo_url} /> : "🏢"}</div>
            <b>{c.name}</b><small>{c.location}</small>
            {!!c.verified && <Badge tone="good">✓ Verified</Badge>}
          </a>
        ))}
      </div>
    </div>
  );
}
window.CompaniesList = CompaniesList;

function CompanyDetail({ id }) {
  const [company, setCompany] = React.useState(null);
  const { user } = window.useAuth();
  React.useEffect(() => { window.api.company(id).then(setCompany).catch(() => window.showToast("Company not found.", "error")); }, [id]);
  if (!company) return <div className="page-shell"><Spinner /></div>;
  const follow = async () => {
    if (!user) return window.navigate("/login");
    try { await window.api.followCompany(id); window.showToast("Following " + company.name); } catch (e) { window.showToast(e.message, "error"); }
  };
  return (
    <div className="page-shell narrow">
      <div className="company-detail-head">
        <div className="company-logo">{company.logo_url ? <img src={company.logo_url} /> : "🏢"}</div>
        <div><h1>{company.name} {!!company.verified && <Badge tone="good">✓ Verified Employer</Badge>}</h1><p className="muted">{company.location} · {company.size} employees</p></div>
        <button className="btn ghost" onClick={follow}>+ Follow</button>
      </div>
      <p>{company.description}</p>
      {company.culture && <section><h3>Culture</h3><p>{company.culture}</p></section>}
      {company.benefits && <section><h3>Benefits</h3><p>{company.benefits}</p></section>}
      <section><h3>Open Positions ({company.openJobs?.length || 0})</h3>
        <div className="job-grid">{(company.openJobs || []).map((j) => <JobCard key={j.id} job={{ ...j, company_name: company.name, company_logo: company.logo_url }} />)}</div>
      </section>
    </div>
  );
}
window.CompanyDetail = CompanyDetail;
