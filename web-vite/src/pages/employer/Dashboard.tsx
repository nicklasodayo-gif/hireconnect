import { useEffect, useMemo, useState } from "react";
import { employerApi, applicationApi } from "@/api";
import type { Application, EmployerDashboardStats, Job } from "@/types";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { MiniBarChart, MiniLineChart } from "@/components";

export function EmployerDashboard() {
  const [stats, setStats] = useState<EmployerDashboardStats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      employerApi.dashboard().then(setStats).catch(() => {}),
      employerApi.myJobs().then((r) => setJobs(r.jobs)).catch(() => {}),
      applicationApi.list().then((r) => setApps(r.applications)).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  // All chart data below is aggregated from records actually fetched above
  // — nothing here is invented, per the brief's "do not create fake charts."
  const applicationsOverTime = useMemo(() => {
    const byDay = new Map<string, number>();
    apps.forEach((a) => {
      const day = new Date(a.applied_at).toISOString().slice(5, 10); // MM-DD
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    });
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([label, value]) => ({ label, value }));
  }, [apps]);

  const topJobsByViews = useMemo(() => [...jobs].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
    .map((j) => ({ label: j.title.length > 18 ? j.title.slice(0, 18) + "…" : j.title, value: j.views ?? 0 })), [jobs]);

  const topJobsByApplications = useMemo(() => {
    const counts = new Map<number, number>();
    apps.forEach((a) => counts.set(a.job_id, (counts.get(a.job_id) ?? 0) + 1));
    return jobs.map((j) => ({ job: j, count: counts.get(j.id) ?? 0 })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [jobs, apps]);

  const conversionRate = apps.length > 0
    ? Math.round((apps.filter((a) => ["shortlisted", "interview", "offer", "hired"].includes(a.status)).length / apps.length) * 100)
    : 0;

  if (loading || !stats) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell">
      <div className="section-head"><h1>Employer Dashboard</h1><a className="btn primary" href="#/employer/jobs/new">+ Post a Job</a></div>
      <div className="stat-cards">
        <div className="stat-card"><b>{stats.activeJobs}</b><span>Active Jobs</span></div>
        <div className="stat-card"><b>{stats.totalApplications}</b><span>Total Applications</span></div>
        <div className="stat-card"><b>{stats.shortlisted}</b><span>Shortlisted</span></div>
        <div className="stat-card"><b>{stats.interviews}</b><span>Interviews</span></div>
        <div className="stat-card"><b>{stats.offers}</b><span>Offers</span></div>
        <div className="stat-card"><b>{stats.hires}</b><span>Hires</span></div>
        <div className="stat-card"><b>{stats.qualifiedApplicants}</b><span>Qualified Applicants</span></div>
        <div className="stat-card"><b>{conversionRate}%</b><span>Conversion Rate</span></div>
      </div>

      <div className="dash-grid">
        <div className="card-form">
          <h3>Applications over time</h3>
          <MiniLineChart data={applicationsOverTime} />
        </div>
        <div className="card-form">
          <h3>Candidate pipeline</h3>
          <MiniBarChart data={[
            { label: "Applications", value: stats.totalApplications },
            { label: "Shortlisted", value: stats.shortlisted },
            { label: "Interviews", value: stats.interviews },
            { label: "Hires", value: stats.hires }
          ]} />
        </div>
      </div>

      <div className="dash-grid">
        <div className="card-form">
          <h3>Job views</h3>
          {topJobsByViews.length === 0 ? <p className="muted">No published jobs yet.</p> : <MiniBarChart data={topJobsByViews} />}
        </div>
        <div className="card-form">
          <h3>Top performing jobs</h3>
          {topJobsByApplications.every((j) => j.count === 0)
            ? <p className="muted">No applications yet.</p>
            : <div className="job-list-table">{topJobsByApplications.map(({ job, count }) => (
                <div className="job-list-row" key={job.id}><b>{job.title}</b><Badge>{count} applications</Badge></div>
              ))}</div>}
        </div>
      </div>

      <div className="section-head"><h2>Your Job Postings</h2><a href="#/employer/jobs">Manage all →</a></div>
      {jobs.length === 0 ? (
        <EmptyState icon="📋" title="No jobs posted yet" body="Create your company profile, then post your first job." action={<a className="btn primary" href="#/employer/company">Set up company</a>} />
      ) : (
        <div className="job-list-table">
          {jobs.slice(0, 5).map((j) => (
            <div className="job-list-row" key={j.id}>
              <b>{j.title}</b>
              <Badge tone={j.status === "published" ? "good" : "neutral"}>{j.status}</Badge>
              <a className="btn subtle sm" href={`#/employer/ats?job=${j.id}`}>View applicants</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
