function AdminDashboard() {
  const [tab, setTab] = React.useState("overview");
  const [stats, setStats] = React.useState(null);
  const [users, setUsers] = React.useState(null);
  const [pendingCompanies, setPendingCompanies] = React.useState(null);
  const [reports, setReports] = React.useState(null);
  const [logs, setLogs] = React.useState(null);

  const loadAll = () => {
    window.api.adminStats().then(setStats).catch(() => {});
    window.api.adminUsers().then((r) => setUsers(r.users)).catch(() => {});
    window.api.pendingCompanies().then((r) => setPendingCompanies(r.companies)).catch(() => {});
    window.api.adminReports().then((r) => setReports(r.reports)).catch(() => {});
    window.api.adminLogs().then((r) => setLogs(r.logs)).catch(() => {});
  };
  React.useEffect(loadAll, []);

  const act = async (fn, ...args) => { try { await fn(...args); loadAll(); } catch (e) { window.showToast(e.message, "error"); } };

  if (!stats) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell wide">
      <h1>Admin Dashboard</h1>
      <div className="tab-bar">
        {["overview", "companies", "users", "reports", "logs"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="stat-cards">
          <div className="stat-card"><b>{stats.totalUsers}</b><span>Total Users</span></div>
          <div className="stat-card"><b>{stats.jobSeekers}</b><span>Job Seekers</span></div>
          <div className="stat-card"><b>{stats.employers}</b><span>Employers</span></div>
          <div className="stat-card"><b>{stats.activeJobs}</b><span>Active Jobs</span></div>
          <div className="stat-card"><b>{stats.applications}</b><span>Applications</span></div>
          <div className="stat-card"><b>{stats.interviews}</b><span>Interviews</span></div>
          <div className="stat-card"><b>{stats.hires}</b><span>Successful Hires</span></div>
          <div className="stat-card"><b>{stats.reportedContent}</b><span>Reported Content</span></div>
          <div className="stat-card"><b>{stats.pendingCompanies}</b><span>Pending Companies</span></div>
        </div>
      )}

      {tab === "companies" && (
        <div className="admin-list">
          {!pendingCompanies ? <Spinner /> : pendingCompanies.length === 0 ? <EmptyState icon="✅" title="No pending companies" body="All caught up." /> : pendingCompanies.map((c) => (
            <div className="admin-row" key={c.id}>
              <div><b>{c.name}</b><small className="muted"> — {c.location}</small></div>
              <div className="row-actions">
                <button className="btn subtle sm" onClick={() => act(window.api.approveCompany, c.id)}>Approve &amp; Verify</button>
                <button className="btn ghost sm danger" onClick={() => act(window.api.rejectCompany, c.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="admin-list">
          {!users ? <Spinner /> : users.map((u) => (
            <div className="admin-row" key={u.id}>
              <div><b>{u.email}</b><small className="muted"> — {u.role}</small></div>
              <Badge tone={u.status === "active" ? "good" : "bad"}>{u.status}</Badge>
              <div className="row-actions">
                {u.status === "active"
                  ? <button className="btn ghost sm danger" onClick={() => act(window.api.suspendUser, u.id)}>Suspend</button>
                  : <button className="btn subtle sm" onClick={() => act(window.api.restoreUser, u.id)}>Restore</button>}
                <button className="btn ghost sm danger" onClick={() => { if (confirm("Delete this user?")) act(window.api.deleteUser, u.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className="admin-list">
          {!reports ? <Spinner /> : reports.length === 0 ? <EmptyState icon="🛡️" title="No reports" body="No fraud or safety reports have been filed." /> : reports.map((r) => (
            <div className="admin-row" key={r.id}>
              <div><b>{r.target_type} #{r.target_id}</b><small className="muted"> — {r.reason}</small></div>
              <Badge tone={r.status === "pending" ? "warn" : r.status === "reviewed" ? "good" : "neutral"}>{r.status}</Badge>
              {r.status === "pending" && (
                <div className="row-actions">
                  <button className="btn subtle sm" onClick={() => act(window.api.resolveReport, r.id, "reviewed")}>Mark Reviewed</button>
                  <button className="btn ghost sm" onClick={() => act(window.api.resolveReport, r.id, "dismissed")}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="admin-list">
          {!logs ? <Spinner /> : logs.length === 0 ? <EmptyState icon="🧾" title="No activity yet" body="Admin actions will be logged here." /> : logs.map((l) => (
            <div className="admin-row" key={l.id}><div><b>{l.action}</b><small className="muted"> — {l.target_type} #{l.target_id}</small></div><small>{window.timeAgo(l.created_at)}</small></div>
          ))}
        </div>
      )}
    </div>
  );
}
window.AdminDashboard = AdminDashboard;
