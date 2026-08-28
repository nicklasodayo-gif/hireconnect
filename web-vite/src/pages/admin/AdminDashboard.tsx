import { useEffect, useState } from "react";
import { adminApi } from "@/api";
import type { AdminLogEntry, AdminStats, AdminUser, AnalyticsSummary, Report, Company } from "@/types";
import { Badge, EmptyState, Spinner, Tabs } from "@/components/ui";
import { MiniBarChart, MiniLineChart } from "@/components";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/utils/format";

type TabId = "overview" | "analytics" | "companies" | "users" | "reports" | "logs";

export function AdminDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [pendingCompanies, setPendingCompanies] = useState<Company[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [logs, setLogs] = useState<AdminLogEntry[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const toast = useToast();

  const loadAll = () => {
    adminApi.stats().then(setStats).catch(() => {});
    adminApi.analytics(30).then(setAnalytics).catch(() => {});
    adminApi.users().then((r) => setUsers(r.users)).catch(() => {});
    adminApi.pendingCompanies().then((r) => setPendingCompanies(r.companies)).catch(() => {});
    adminApi.reports().then((r) => setReports(r.reports)).catch(() => {});
    adminApi.logs().then((r) => setLogs(r.logs)).catch(() => {});
  };
  useEffect(loadAll, []);

  const act = async (fn: (...args: any[]) => Promise<unknown>, ...args: any[]) => {
    try { await fn(...args); loadAll(); } catch (e) { toast.show(e instanceof Error ? e.message : "Action failed.", "error"); }
  };

  if (!stats) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell wide">
      <h1>Admin Dashboard</h1>
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" }, { id: "analytics", label: "Analytics" }, { id: "companies", label: "Companies" },
          { id: "users", label: "Users" }, { id: "reports", label: "Reports" }, { id: "logs", label: "Logs" }
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

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

      {tab === "analytics" && (
        <div className="dash-grid">
          <div className="card-form">
            <h3>Daily signups (last {analytics?.windowDays ?? 30} days)</h3>
            {!analytics ? <Spinner /> : <MiniLineChart data={analytics.dailySignups.map((d) => ({ label: d.day.slice(5), value: d.count }))} />}
          </div>
          <div className="card-form">
            <h3>Daily applications</h3>
            {!analytics ? <Spinner /> : <MiniLineChart data={analytics.dailyApplications.map((d) => ({ label: d.day.slice(5), value: d.count }))} />}
          </div>
          <div className="card-form">
            <h3>Platform events</h3>
            {!analytics ? <Spinner /> : analytics.eventsByType.length === 0
              ? <p className="muted">No events recorded yet.</p>
              : <MiniBarChart data={analytics.eventsByType.map((e) => ({ label: e.event_type, value: e.count }))} />}
          </div>
        </div>
      )}

      {tab === "companies" && (
        <div className="admin-list">
          {!pendingCompanies ? <Spinner /> : pendingCompanies.length === 0 ? <EmptyState icon="✅" title="No pending companies" body="All caught up." /> : pendingCompanies.map((c) => (
            <div className="admin-row" key={c.id}>
              <div><b>{c.name}</b><small className="muted"> — {c.location}</small></div>
              <div className="row-actions">
                <button className="btn subtle sm" onClick={() => act(adminApi.approveCompany, c.id)}>Approve &amp; Verify</button>
                <button className="btn ghost sm danger" onClick={() => act(adminApi.rejectCompany, c.id)}>Reject</button>
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
                  ? <button className="btn ghost sm danger" onClick={() => act(adminApi.suspendUser, u.id)}>Suspend</button>
                  : <button className="btn subtle sm" onClick={() => act(adminApi.restoreUser, u.id)}>Restore</button>}
                <button className="btn ghost sm danger" onClick={() => { if (confirm("Delete this user?")) act(adminApi.deleteUser, u.id); }}>Delete</button>
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
                  <button className="btn subtle sm" onClick={() => act(adminApi.resolveReport, r.id, "reviewed")}>Mark Reviewed</button>
                  <button className="btn ghost sm" onClick={() => act(adminApi.resolveReport, r.id, "dismissed")}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "logs" && (
        <div className="admin-list">
          {!logs ? <Spinner /> : logs.length === 0 ? <EmptyState icon="🧾" title="No activity yet" body="Admin actions will be logged here." /> : logs.map((l) => (
            <div className="admin-row" key={l.id}><div><b>{l.action}</b><small className="muted"> — {l.target_type} #{l.target_id}</small></div><small>{timeAgo(l.created_at)}</small></div>
          ))}
        </div>
      )}
    </div>
  );
}
