function MiniBarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="mini-bar-chart">
      {data.map((d) => (
        <div className="mini-bar-row" key={d.label}>
          <span>{d.label}</span>
          <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <b>{d.value}</b>
        </div>
      ))}
    </div>
  );
}

function EmployerDashboard() {
  const [stats, setStats] = React.useState(null);
  const [jobs, setJobs] = React.useState([]);
  React.useEffect(() => {
    window.api.employerDashboard().then(setStats).catch(() => {});
    window.api.employerJobs().then((r) => setJobs(r.jobs)).catch(() => {});
  }, []);
  if (!stats) return <div className="page-shell"><Spinner /></div>;
  const hasCompany = jobs !== null;
  return (
    <div className="page-shell">
      <div className="section-head"><h1>Employer Dashboard</h1><a className="btn primary" href="#/employer/jobs/new">+ Post a Job</a></div>
      <div className="stat-cards">
        <div className="stat-card"><b>{stats.activeJobs}</b><span>Active Jobs</span></div>
        <div className="stat-card"><b>{stats.totalApplications}</b><span>Total Applications</span></div>
        <div className="stat-card"><b>{stats.shortlisted}</b><span>Shortlisted</span></div>
        <div className="stat-card"><b>{stats.interviews}</b><span>Interviews</span></div>
        <div className="stat-card"><b>{stats.hires}</b><span>Hires</span></div>
        <div className="stat-card"><b>{stats.profileViews}</b><span>Job Views</span></div>
      </div>
      <div className="card-form">
        <h3>Hiring funnel</h3>
        <MiniBarChart data={[{ label: "Applications", value: stats.totalApplications }, { label: "Shortlisted", value: stats.shortlisted }, { label: "Interviews", value: stats.interviews }, { label: "Hires", value: stats.hires }]} />
      </div>
      <div className="section-head"><h2>Your Job Postings</h2><a href="#/employer/jobs">Manage all →</a></div>
      {jobs.length === 0 ? <EmptyState icon="📋" title="No jobs posted yet" body="Create your company profile, then post your first job." action={<a className="btn primary" href="#/employer/company">Set up company</a>} />
        : <div className="job-list-table">{jobs.slice(0, 5).map((j) => (
            <div className="job-list-row" key={j.id}><b>{j.title}</b><Badge tone={j.status === "published" ? "good" : "neutral"}>{j.status}</Badge><a className="btn subtle sm" href={`#/employer/ats?job=${j.id}`}>View applicants</a></div>
          ))}</div>}
    </div>
  );
}
window.EmployerDashboard = EmployerDashboard;

function CompanyForm() {
  const [form, setForm] = React.useState({ name: "", description: "", website: "", location: "", size: "", foundedYear: "", culture: "", benefits: "" });
  const [companyId, setCompanyId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const { user } = window.useAuth();

  React.useEffect(() => {
    window.api.employerJobs().catch(() => {}); // warms nothing, just ensures auth; company lookup below
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (companyId) { await window.api.updateCompany(companyId, form); window.showToast("Company updated."); }
      else { const c = await window.api.createCompany(form); setCompanyId(c.id); window.showToast("Company created! Awaiting admin verification."); }
    } catch (err) { window.showToast(err.message, "error"); } finally { setSaving(false); }
  };

  return (
    <div className="page-shell narrow">
      <h1>Company Profile</h1>
      <p className="muted">New companies are reviewed by our team before jobs go live — you can still save a draft now and post once approved.</p>
      <form className="card-form" onSubmit={submit}>
        <label>Company name<input required value={form.name} onChange={set("name")} /></label>
        <label>Description<textarea value={form.description} onChange={set("description")} /></label>
        <div className="form-row">
          <label>Website<input value={form.website} onChange={set("website")} /></label>
          <label>Location<input value={form.location} onChange={set("location")} /></label>
        </div>
        <div className="form-row">
          <label>Company size
            <select value={form.size} onChange={set("size")}>
              <option value="">—</option><option>1-10</option><option>11-50</option><option>51-200</option><option>201-500</option><option>500+</option>
            </select>
          </label>
          <label>Founded year<input type="number" value={form.foundedYear} onChange={set("foundedYear")} /></label>
        </div>
        <label>Culture<textarea value={form.culture} onChange={set("culture")} /></label>
        <label>Benefits<textarea value={form.benefits} onChange={set("benefits")} /></label>
        <button className="btn primary wide" disabled={saving}>{saving ? "Saving…" : companyId ? "Update Company" : "Create Company"}</button>
      </form>
    </div>
  );
}
window.CompanyForm = CompanyForm;

function JobPostingForm({ jobId }) {
  const [form, setForm] = React.useState({ title: "", department: "", description: "", responsibilities: "", requirements: "", experienceLevel: "mid", educationRequirement: "", employmentType: "full_time", workMode: "onsite", location: "", salaryMin: "", salaryMax: "", benefits: "", openings: 1, applicationDeadline: "", skills: [] });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { if (jobId) window.api.job(jobId).then((j) => setForm((f) => ({ ...f, ...j, skills: (j.skills || []).map((s) => s.name) }))); }, [jobId]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e, publish) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, status: publish ? "published" : "draft" };
      let job;
      if (jobId) { job = await window.api.updateJob(jobId, payload); if (publish) await window.api.publishJob(jobId); }
      else job = await window.api.createJob(payload);
      window.showToast(publish ? "Job published!" : "Draft saved.", "success");
      window.navigate("/employer/jobs");
    } catch (err) { window.showToast(err.message, "error"); } finally { setSaving(false); }
  };

  const addSkill = (name) => setForm((f) => (f.skills.includes(name) ? f : { ...f, skills: [...f.skills, name] }));

  return (
    <div className="page-shell narrow">
      <h1>{jobId ? "Edit Job" : "Post a New Job"}</h1>
      <form className="card-form">
        <label>Job title<input required value={form.title} onChange={set("title")} /></label>
        <label>Department<input value={form.department} onChange={set("department")} /></label>
        <label>Description<textarea required value={form.description} onChange={set("description")} /></label>
        <label>Responsibilities<textarea value={form.responsibilities} onChange={set("responsibilities")} /></label>
        <label>Requirements<textarea value={form.requirements} onChange={set("requirements")} /></label>
        <div className="form-row">
          <label>Experience level
            <select value={form.experienceLevel} onChange={set("experienceLevel")}><option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="executive">Executive</option></select>
          </label>
          <label>Education requirement
            <select value={form.educationRequirement || ""} onChange={set("educationRequirement")}>
              <option value="">None specified</option><option value="certificate">Certificate</option><option value="diploma">Diploma</option><option value="bachelor">Bachelor's</option><option value="master">Master's</option><option value="phd">PhD</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Employment type
            <select value={form.employmentType} onChange={set("employmentType")}><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option></select>
          </label>
          <label>Work mode
            <select value={form.workMode} onChange={set("workMode")}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
          </label>
        </div>
        <label>Location<input value={form.location} onChange={set("location")} /></label>
        <div className="form-row">
          <label>Salary min (KES)<input type="number" value={form.salaryMin} onChange={set("salaryMin")} /></label>
          <label>Salary max (KES)<input type="number" value={form.salaryMax} onChange={set("salaryMax")} /></label>
        </div>
        <label>Benefits<textarea value={form.benefits} onChange={set("benefits")} /></label>
        <div className="form-row">
          <label>Number of openings<input type="number" min="1" value={form.openings} onChange={set("openings")} /></label>
          <label>Application deadline<input type="date" value={form.applicationDeadline || ""} onChange={set("applicationDeadline")} /></label>
        </div>
        <div>
          <label>Required skills</label>
          <TagInput items={form.skills} onAdd={addSkill} placeholder="Add a required skill" />
        </div>
        <div className="form-row">
          <button className="btn ghost wide" disabled={saving} onClick={(e) => submit(e, false)}>Save Draft</button>
          <button className="btn primary wide" disabled={saving} onClick={(e) => submit(e, true)}>Publish Job</button>
        </div>
      </form>
    </div>
  );
}
window.JobPostingForm = JobPostingForm;

function EmployerJobsList() {
  const [jobs, setJobs] = React.useState(null);
  const load = () => window.api.employerJobs().then((r) => setJobs(r.jobs));
  React.useEffect(() => { load(); }, []);
  if (!jobs) return <div className="page-shell"><Spinner /></div>;

  const act = async (fn, id) => { try { await fn(id); load(); } catch (e) { window.showToast(e.message, "error"); } };

  return (
    <div className="page-shell">
      <div className="section-head"><h1>My Job Postings</h1><a className="btn primary" href="#/employer/jobs/new">+ Post a Job</a></div>
      {jobs.length === 0 ? <EmptyState icon="📋" title="No jobs yet" body="Post your first job to start receiving applications." /> : (
        <div className="job-list-table">
          {jobs.map((j) => (
            <div className="job-list-row" key={j.id}>
              <div><b>{j.title}</b><small className="muted"> · {j.employment_type} · {j.location}</small></div>
              <Badge tone={j.status === "published" ? "good" : j.status === "paused" ? "warn" : j.status === "closed" ? "bad" : "neutral"}>{j.status}</Badge>
              <div className="row-actions">
                <a className="btn subtle sm" href={`#/employer/ats?job=${j.id}`}>Applicants</a>
                <a className="btn ghost sm" href={`#/employer/jobs/${j.id}/edit`}>Edit</a>
                {j.status === "published" && <button className="btn ghost sm" onClick={() => act(window.api.pauseJob, j.id)}>Pause</button>}
                {j.status === "paused" && <button className="btn ghost sm" onClick={() => act(window.api.publishJob, j.id)}>Resume</button>}
                {j.status !== "closed" && <button className="btn ghost sm" onClick={() => act(window.api.closeJob, j.id)}>Close</button>}
                <button className="btn ghost sm" onClick={() => act(window.api.duplicateJob, j.id)}>Duplicate</button>
                <button className="btn ghost sm danger" onClick={() => { if (confirm("Delete this job posting?")) act(window.api.deleteJob, j.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.EmployerJobsList = EmployerJobsList;

const ATS_COLUMNS = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected"];

function ApplicationDetailModal({ id, onClose, onChanged }) {
  const [app, setApp] = React.useState(null);
  const [note, setNote] = React.useState("");
  const [rating, setRating] = React.useState(0);
  const [interview, setInterview] = React.useState({ scheduledAt: "", type: "video", locationOrLink: "" });
  const load = () => window.api.application(id).then(setApp);
  React.useEffect(() => { load(); }, [id]);
  if (!app) return <Modal title="Application" onClose={onClose}><Spinner /></Modal>;

  const changeStatus = async (status) => { try { await window.api.setApplicationStatus(id, { status }); load(); onChanged(); } catch (e) { window.showToast(e.message, "error"); } };
  const addNote = async (e) => { e.preventDefault(); if (!note.trim()) return; try { await window.api.addApplicationNote(id, { note }); setNote(""); load(); } catch (e) { window.showToast(e.message, "error"); } };
  const rate = async (n) => { setRating(n); try { await window.api.rateApplication(id, { rating: n }); } catch (e) { window.showToast(e.message, "error"); } };
  const scheduleInterview = async (e) => {
    e.preventDefault();
    try { await window.api.createInterview({ applicationId: id, ...interview }); window.showToast("Interview scheduled."); load(); onChanged(); }
    catch (e) { window.showToast(e.message, "error"); }
  };
  const message = async () => { try { await window.api.startConversation(id); window.navigate("/messages"); } catch (e) { window.showToast(e.message, "error"); } };
  const downloadCv = async () => {
    try {
      const token = window.getToken();
      const res = await fetch(`${window.API_BASE}/api/candidates/${app.candidate_profile_id || app.candidate_id}/cv`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "No CV on file for this candidate."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${app.candidate_name || "candidate"}-cv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { window.showToast(e.message, "error"); }
  };

  return (
    <Modal title={app.candidate_name} onClose={onClose} width="640px">
      <div className="app-detail">
        <div className="app-detail-top">
          <div><b>{app.job_title}</b><small className="muted"> — applied {window.timeAgo(app.applied_at)}</small></div>
          <MatchBadge score={app.match_score} />
        </div>
        <div className="status-actions">{ATS_COLUMNS.map((s) => <button key={s} className={`btn sm ${app.status === s ? "primary" : "ghost"}`} onClick={() => changeStatus(s)}>{window.STATUS_LABELS[s]}</button>)}</div>
        <div className="star-row">Rate candidate: {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`star ${(rating || app.rating || 0) >= n ? "on" : ""}`} onClick={() => rate(n)}>★</span>)}</div>
        <button className="btn subtle sm" onClick={message}>💬 Message candidate</button>
        <button className="btn subtle sm" onClick={downloadCv}>⬇ Download CV</button>

        <h4>Schedule interview</h4>
        <form className="form-row" onSubmit={scheduleInterview}>
          <input type="datetime-local" required onChange={(e) => setInterview((i) => ({ ...i, scheduledAt: e.target.value }))} />
          <select value={interview.type} onChange={(e) => setInterview((i) => ({ ...i, type: e.target.value }))}>
            <option value="video">Video</option><option value="phone">Phone</option><option value="physical">Physical</option><option value="technical">Technical</option><option value="hr">HR</option><option value="panel">Panel</option>
          </select>
          <input placeholder="Location or link" onChange={(e) => setInterview((i) => ({ ...i, locationOrLink: e.target.value }))} />
          <button className="btn subtle sm">Schedule</button>
        </form>

        <h4>Notes</h4>
        <div className="notes-list">{app.notes.map((n) => <div className="note-item" key={n.id}>{n.note}</div>)}</div>
        <form className="inline-add" onSubmit={addNote}><input placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn subtle">Add</button></form>

        <h4>History</h4>
        <div className="history-list">{app.history.map((h) => <div key={h.id} className="history-item"><StatusPill status={h.status} /><small>{window.timeAgo(h.created_at)}</small></div>)}</div>
      </div>
    </Modal>
  );
}

function ATSBoard() {
  const [apps, setApps] = React.useState(null);
  const [openId, setOpenId] = React.useState(null);
  const load = () => window.api.applications().then((r) => setApps(r.applications));
  React.useEffect(() => { load(); }, []);
  if (!apps) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell wide">
      <h1>Applicant Tracking</h1>
      {apps.length === 0 ? <EmptyState icon="🗂️" title="No applicants yet" body="Applications to your jobs will appear here." /> : (
        <div className="ats-board">
          {ATS_COLUMNS.map((status) => (
            <div className="ats-column" key={status}>
              <div className="ats-column-head"><StatusPill status={status} /><span>{apps.filter((a) => a.status === status).length}</span></div>
              {apps.filter((a) => a.status === status).map((a) => (
                <button className="ats-card" key={a.id} onClick={() => setOpenId(a.id)}>
                  <div className="ats-card-top">{a.candidate_photo ? <img src={a.candidate_photo} /> : <span className="avatar-fallback">👤</span>}<b>{a.candidate_name}</b></div>
                  <small className="muted">{a.job_title}</small>
                  {a.match_score != null && <MatchBadge score={a.match_score} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {openId && <ApplicationDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
window.ATSBoard = ATSBoard;
