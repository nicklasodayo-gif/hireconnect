function ProfileStrength({ profile }) {
  return (
    <div className="strength-card">
      <div className="strength-head"><b>Profile Strength</b><span>{profile.profile_completion}%</span></div>
      <ProgressBar value={profile.profile_completion} tone={profile.profile_completion >= 70 ? "good" : "warn"} />
      {profile.missing?.length > 0 && (
        <ul className="missing-list">{profile.missing.slice(0, 3).map((m) => <li key={m}>{m}</li>)}</ul>
      )}
    </div>
  );
}

function CandidateDashboard() {
  const [profile, setProfile] = React.useState(null);
  const [recommended, setRecommended] = React.useState([]);
  const [apps, setApps] = React.useState([]);
  React.useEffect(() => {
    window.api.myProfile().then(setProfile).catch(() => {});
    window.api.recommendedJobs().then((r) => setRecommended(r.jobs.slice(0, 4))).catch(() => {});
    window.api.applications().then((r) => setApps(r.applications)).catch(() => {});
  }, []);
  if (!profile) return <div className="page-shell"><Spinner /></div>;
  const active = apps.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;
  return (
    <div className="page-shell">
      <h1>Welcome back, {profile.full_name?.split(" ")[0] || "there"} 👋</h1>
      <div className="dash-grid">
        <ProfileStrength profile={profile} />
        <div className="mini-stats">
          <div><b>{apps.length}</b><span>Applications</span></div>
          <div><b>{active}</b><span>Active</span></div>
          <div><b>{apps.filter((a) => a.status === "shortlisted").length}</b><span>Shortlisted</span></div>
          <div><b>{apps.filter((a) => a.status === "interview").length}</b><span>Interviews</span></div>
        </div>
      </div>
      <div className="section-head"><h2>Recommended for you</h2><a href="#/jobs">Browse all jobs →</a></div>
      {recommended.length === 0 ? <EmptyState icon="✨" title="Complete your profile" body="Add skills and preferences to get personalized recommendations." action={<a className="btn primary" href="#/profile">Edit profile</a>} />
        : <div className="job-grid">{recommended.map((j) => <window.JobCard key={j.id} job={j} />)}</div>}
      <div className="quick-links">
        <a className="quick-link" href="#/applications">📋 Track Applications</a>
        <a className="quick-link" href="#/saved">☆ Saved Jobs</a>
        <a className="quick-link" href="#/profile">👤 Edit Profile</a>
        <a className="quick-link" href="#/messages">💬 Messages</a>
      </div>
    </div>
  );
}
window.CandidateDashboard = CandidateDashboard;

function TagInput({ items, onAdd, onFile, placeholder }) {
  const [value, setValue] = React.useState("");
  const add = (e) => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); } };
  return (
    <div>
      <div className="pill-row">{items.map((s) => <Badge key={s.name || s}>{s.name || s}</Badge>)}</div>
      <form className="inline-add" onSubmit={add}><input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} /><button className="btn subtle">Add</button></form>
    </div>
  );
}

function ProfileEdit() {
  const [profile, setProfile] = React.useState(null);
  const [form, setForm] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [eduForm, setEduForm] = React.useState({ institution: "", degree: "", field: "", startYear: "", endYear: "" });
  const [expForm, setExpForm] = React.useState({ company: "", title: "", startDate: "", isCurrent: false, description: "" });

  const load = () => window.api.myProfile().then((p) => { setProfile(p); setForm(p); });
  React.useEffect(() => { load(); }, []);

  if (!profile || !form) return <div className="page-shell"><Spinner /></div>;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await window.api.updateProfile({
        fullName: form.full_name, headline: form.headline, bio: form.bio, location: form.location, phone: form.phone,
        yearsExperience: form.years_experience, preferredJobType: form.preferred_job_type, preferredLocation: form.preferred_location,
        preferredWorkMode: form.preferred_work_mode, expectedSalaryMin: form.expected_salary_min, expectedSalaryMax: form.expected_salary_max,
        availability: form.availability, careerInterests: form.career_interests, linkedinUrl: form.linkedin_url, githubUrl: form.github_url, portfolioUrl: form.portfolio_url
      });
      window.showToast("Profile saved.", "success"); load();
    } catch (err) { window.showToast(err.message, "error"); } finally { setSaving(false); }
  };

  const addSkill = (name) => window.api.addSkill({ name }).then(load).catch((e) => window.showToast(e.message, "error"));
  const addEducation = (e) => { e.preventDefault(); window.api.addEducation(eduForm).then(() => { load(); setEduForm({ institution: "", degree: "", field: "", startYear: "", endYear: "" }); }).catch((err) => window.showToast(err.message, "error")); };
  const addExperience = (e) => { e.preventDefault(); window.api.addExperience(expForm).then(() => { load(); setExpForm({ company: "", title: "", startDate: "", isCurrent: false, description: "" }); }).catch((err) => window.showToast(err.message, "error")); };

  const onCvFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(",")[1];
      try { await window.api.uploadCv({ fileName: file.name, base64 }); window.showToast("CV uploaded."); load(); }
      catch (err) { window.showToast(err.message, "error"); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page-shell narrow">
      <h1>Your Profile</h1>
      <ProfileStrength profile={profile} />

      <form className="card-form" onSubmit={save}>
        <h3>Basics</h3>
        <label>Full name<input value={form.full_name || ""} onChange={set("full_name")} /></label>
        <label>Headline<input placeholder="e.g. Backend Engineer" value={form.headline || ""} onChange={set("headline")} /></label>
        <label>Bio<textarea value={form.bio || ""} onChange={set("bio")} /></label>
        <div className="form-row">
          <label>Location<input value={form.location || ""} onChange={set("location")} /></label>
          <label>Phone<input value={form.phone || ""} onChange={set("phone")} /></label>
        </div>
        <label>Years of experience<input type="number" min="0" step="0.5" value={form.years_experience || 0} onChange={set("years_experience")} /></label>

        <h3>Preferences</h3>
        <div className="form-row">
          <label>Preferred job type
            <select value={form.preferred_job_type || ""} onChange={set("preferred_job_type")}>
              <option value="">—</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option>
            </select>
          </label>
          <label>Preferred work mode
            <select value={form.preferred_work_mode || ""} onChange={set("preferred_work_mode")}>
              <option value="">—</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
            </select>
          </label>
        </div>
        <label>Preferred location<input value={form.preferred_location || ""} onChange={set("preferred_location")} /></label>
        <div className="form-row">
          <label>Expected salary min (KES)<input type="number" value={form.expected_salary_min || ""} onChange={set("expected_salary_min")} /></label>
          <label>Expected salary max (KES)<input type="number" value={form.expected_salary_max || ""} onChange={set("expected_salary_max")} /></label>
        </div>
        <label>Availability
          <select value={form.availability || ""} onChange={set("availability")}>
            <option value="">—</option><option value="immediate">Immediate</option><option value="2_weeks">2 weeks notice</option><option value="1_month">1 month notice</option><option value="negotiable">Negotiable</option>
          </select>
        </label>
        <label>Career interests<textarea value={form.career_interests || ""} onChange={set("career_interests")} /></label>

        <h3>Links</h3>
        <label>LinkedIn<input value={form.linkedin_url || ""} onChange={set("linkedin_url")} /></label>
        <label>GitHub<input value={form.github_url || ""} onChange={set("github_url")} /></label>
        <label>Portfolio<input value={form.portfolio_url || ""} onChange={set("portfolio_url")} /></label>

        <button className="btn primary wide" disabled={saving}>{saving ? "Saving…" : "Save Profile"}</button>
      </form>

      <div className="card-form">
        <h3>Skills</h3>
        <TagInput items={profile.skills} onAdd={addSkill} placeholder="Add a skill (e.g. React)" />
      </div>

      <div className="card-form">
        <h3>Education</h3>
        {profile.education.map((ed) => <div className="list-row" key={ed.id}><b>{ed.degree}</b> — {ed.institution} <span className="muted">({ed.start_year}–{ed.end_year || "present"})</span></div>)}
        <form className="form-row" onSubmit={addEducation}>
          <input placeholder="Institution" required value={eduForm.institution} onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))} />
          <input placeholder="Degree" required value={eduForm.degree} onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))} />
          <input placeholder="Start year" value={eduForm.startYear} onChange={(e) => setEduForm((f) => ({ ...f, startYear: e.target.value }))} />
          <input placeholder="End year" value={eduForm.endYear} onChange={(e) => setEduForm((f) => ({ ...f, endYear: e.target.value }))} />
          <button className="btn subtle">Add</button>
        </form>
      </div>

      <div className="card-form">
        <h3>Experience</h3>
        {profile.experience.map((ex) => <div className="list-row" key={ex.id}><b>{ex.title}</b> — {ex.company}</div>)}
        <form className="form-row" onSubmit={addExperience}>
          <input placeholder="Company" required value={expForm.company} onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))} />
          <input placeholder="Title" required value={expForm.title} onChange={(e) => setExpForm((f) => ({ ...f, title: e.target.value }))} />
          <button className="btn subtle">Add</button>
        </form>
      </div>

      <div className="card-form">
        <h3>CV</h3>
        <p className="muted">{profile.cv_path ? "CV on file ✓" : "No CV uploaded yet."}</p>
        <input type="file" accept=".pdf,.doc,.docx" onChange={onCvFile} />
      </div>
    </div>
  );
}
window.ProfileEdit = ProfileEdit;

function ApplicationsTracker() {
  const [apps, setApps] = React.useState(null);
  const load = () => window.api.applications().then((r) => setApps(r.applications));
  React.useEffect(() => { load(); }, []);
  if (!apps) return <div className="page-shell"><Spinner /></div>;
  const withdraw = async (id) => {
    try { await window.api.withdrawApplication(id); window.showToast("Application withdrawn."); load(); }
    catch (e) { window.showToast(e.message, "error"); }
  };
  const groups = window.STATUS_ORDER.concat(["rejected", "withdrawn"]).map((s) => ({ status: s, items: apps.filter((a) => a.status === s) })).filter((g) => g.items.length);
  return (
    <div className="page-shell">
      <h1>Your Applications</h1>
      {apps.length === 0 ? <EmptyState icon="📋" title="No applications yet" body="Applications you submit will show up here." action={<a className="btn primary" href="#/jobs">Browse jobs</a>} /> : (
        <div className="tracker">
          {groups.map((g) => (
            <div className="tracker-group" key={g.status}>
              <div className="tracker-head"><StatusPill status={g.status} /><span>{g.items.length}</span></div>
              {g.items.map((a) => (
                <div className="tracker-card" key={a.id}>
                  <div><b>{a.job_title}</b><small>{a.company_name} · applied {window.timeAgo(a.applied_at)}</small></div>
                  <div className="tracker-right">
                    {a.match_score != null && <MatchBadge score={a.match_score} />}
                    {["applied", "screening", "shortlisted"].includes(a.status) && <button className="btn ghost sm" onClick={() => withdraw(a.id)}>Withdraw</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.ApplicationsTracker = ApplicationsTracker;

function SavedJobs() {
  const [jobs, setJobs] = React.useState(null);
  const load = () => window.api.savedJobs().then((r) => setJobs(r.jobs));
  React.useEffect(() => { load(); }, []);
  if (!jobs) return <div className="page-shell"><Spinner /></div>;
  const unsave = async (jobId) => {
    try { await window.api.unsaveJob(jobId); window.showToast("Removed from saved jobs."); load(); }
    catch (e) { window.showToast(e.message, "error"); }
  };
  return (
    <div className="page-shell">
      <h1>Saved Jobs</h1>
      {jobs.length === 0 ? <EmptyState icon="☆" title="No saved jobs yet" body="Save jobs while browsing to find them here later." />
        : <div className="job-grid">{jobs.map((j) => (
            <div key={j.id}>
              <window.JobCard job={j} />
              <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => unsave(j.id)}>Remove from saved</button>
            </div>
          ))}</div>}
    </div>
  );
}
window.SavedJobs = SavedJobs;

function Notifications() {
  const [items, setItems] = React.useState(null);
  const load = () => window.api.notifications().then((r) => setItems(r.notifications));
  React.useEffect(() => { load(); }, []);
  if (!items) return <div className="page-shell"><Spinner /></div>;
  const markAll = () => window.api.markAllNotificationsRead().then(load);
  const markOne = (id) => window.api.markNotificationRead(id).then(load);
  return (
    <div className="page-shell narrow">
      <div className="section-head"><h1>Notifications</h1>{items.some((n) => !n.read_at) && <button className="btn ghost sm" onClick={markAll}>Mark all as read</button>}</div>
      {items.length === 0 ? <EmptyState icon="🔔" title="You're all caught up" body="New updates will show up here." /> : (
        <div className="notif-list">
          {items.map((n) => (
            <div key={n.id} className={`notif-item ${n.read_at ? "" : "unread"}`} onClick={() => !n.read_at && markOne(n.id)}>
              <b>{n.title}</b><p>{n.body}</p><small>{window.timeAgo(n.created_at)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.Notifications = Notifications;

function Messages() {
  const [conversations, setConversations] = React.useState(null);
  const [activeId, setActiveId] = React.useState(null);
  const [messages, setMessages] = React.useState([]);
  const [text, setText] = React.useState("");
  const { user } = window.useAuth();

  React.useEffect(() => { window.api.conversations().then((r) => setConversations(r.conversations)); }, []);
  React.useEffect(() => { if (activeId) window.api.messages(activeId).then((r) => setMessages(r.messages)); }, [activeId]);

  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    try { await window.api.sendMessage(activeId, { body: text }); setText(""); const r = await window.api.messages(activeId); setMessages(r.messages); }
    catch (err) { window.showToast(err.message, "error"); }
  };

  if (!conversations) return <div className="page-shell"><Spinner /></div>;
  return (
    <div className="page-shell">
      <h1>Messages</h1>
      {conversations.length === 0 ? <EmptyState icon="💬" title="No conversations yet" body="Conversations open automatically once you're in touch about an application." /> : (
        <div className="messages-layout">
          <div className="conv-list">
            {conversations.map((c) => <button key={c.id} className={`conv-item ${activeId === c.id ? "active" : ""}`} onClick={() => setActiveId(c.id)}>Conversation #{c.id}</button>)}
          </div>
          <div className="conv-thread">
            {!activeId ? <EmptyState icon="💬" title="Select a conversation" body="" /> : (
              <>
                <div className="thread-messages">{messages.map((m) => <div key={m.id} className={`msg ${m.sender_id === user.id ? "mine" : ""}`}>{m.body}<small>{window.timeAgo(m.created_at)}</small></div>)}</div>
                <form className="thread-input" onSubmit={send}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" /><button className="btn primary">Send</button></form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
window.Messages = Messages;
