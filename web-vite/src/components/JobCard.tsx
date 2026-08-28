import type { Job } from "@/types";
import { Badge, MatchBadge } from "@/components/ui";
import { formatKES, timeAgo } from "@/utils/format";

export interface JobCardProps {
  job: Job;
  onSave?: (jobId: number) => void;
}

export function JobCard({ job, onSave }: JobCardProps) {
  return (
    <div className="job-card">
      <div className="job-card-top">
        <div className="company-logo-sm">{job.company_logo ? <img src={job.company_logo} alt="" /> : "🏢"}</div>
        <div className="job-card-title">
          <a href={`#/jobs/${job.id}`}><b>{job.title}</b></a>
          <small>{job.company_name} · {job.location || "Remote"}</small>
        </div>
        <MatchBadge score={job.matchScore} />
      </div>
      <div className="job-card-tags">
        <Badge>{(job.employment_type || "").replace("_", " ")}</Badge>
        <Badge>{job.work_mode}</Badge>
        {job.experience_level && <Badge>{job.experience_level}</Badge>}
      </div>
      <div className="job-card-bottom">
        <span className="salary">{formatKES(job.salary_min, job.salary_max)}</span>
        <span className="posted">{timeAgo(job.created_at)}</span>
      </div>
      <div className="job-card-actions">
        <a className="btn subtle" href={`#/jobs/${job.id}`}>View details</a>
        {onSave && <button className="btn ghost" onClick={() => onSave(job.id)}>☆ Save</button>}
      </div>
    </div>
  );
}
