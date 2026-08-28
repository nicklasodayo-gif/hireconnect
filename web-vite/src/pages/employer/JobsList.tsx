import { useEffect, useState } from "react";
import { employerApi, jobApi } from "@/api";
import type { Job, JobStatus } from "@/types";
import { Badge, EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";

const STATUS_TONE: Record<JobStatus, "good" | "neutral" | "warn" | "bad"> = { published: "good", draft: "neutral", paused: "warn", closed: "bad" };

export function EmployerJobsList() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const toast = useToast();
  const load = () => employerApi.myJobs().then((r) => setJobs(r.jobs));
  useEffect(() => { load(); }, []);
  if (!jobs) return <div className="page-shell"><Spinner /></div>;

  const act = async (fn: (id: number | string) => Promise<unknown>, id: number) => {
    try { await fn(id); load(); } catch (e) { toast.show(e instanceof Error ? e.message : "Action failed.", "error"); }
  };

  return (
    <div className="page-shell">
      <div className="section-head"><h1>My Job Postings</h1><a className="btn primary" href="#/employer/jobs/new">+ Post a Job</a></div>
      {jobs.length === 0 ? <EmptyState icon="📋" title="No jobs yet" body="Post your first job to start receiving applications." /> : (
        <div className="job-list-table">
          {jobs.map((j) => (
            <div className="job-list-row" key={j.id}>
              <div><b>{j.title}</b><small className="muted"> · {j.employment_type} · {j.location}</small></div>
              <Badge tone={STATUS_TONE[j.status]}>{j.status}</Badge>
              <div className="row-actions">
                <a className="btn subtle sm" href={`#/employer/ats?job=${j.id}`}>Applicants</a>
                <a className="btn ghost sm" href={`#/employer/jobs/${j.id}/edit`}>Edit</a>
                {j.status === "published" && <button className="btn ghost sm" onClick={() => act(jobApi.pause, j.id)}>Pause</button>}
                {j.status === "paused" && <button className="btn ghost sm" onClick={() => act(jobApi.publish, j.id)}>Resume</button>}
                {j.status !== "closed" && <button className="btn ghost sm" onClick={() => act(jobApi.close, j.id)}>Close</button>}
                <button className="btn ghost sm" onClick={() => act(jobApi.duplicate, j.id)}>Duplicate</button>
                <button className="btn ghost sm danger" onClick={() => { if (confirm("Delete this job posting?")) act(jobApi.remove, j.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
