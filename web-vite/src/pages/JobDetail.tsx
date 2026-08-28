import { useEffect, useState } from "react";
import { jobApi } from "@/api";
import type { Job, MatchResult } from "@/types";
import { Badge, MatchBadge, ProgressBar, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { navigate } from "@/hooks/useHashRoute";
import { formatKES } from "@/utils/format";

export function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    jobApi.get(id).then(setJob).catch(() => toast.show("Job not found.", "error"));
    if (user?.role === "job_seeker") jobApi.match(id).then(setMatch).catch(() => {});
  }, [id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return <div className="page-shell"><Spinner /></div>;

  const apply = async () => {
    setApplying(true);
    try {
      await jobApi.apply(id, coverNote);
      toast.show("Application submitted!", "success");
      navigate("/applications");
    } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't submit application.", "error"); }
    finally { setApplying(false); }
  };

  const save = async () => {
    if (!user) return navigate("/login");
    try { await jobApi.save(id); toast.show("Job saved."); } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't save job.", "error"); }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: job.title, url }); return; }
      await navigator.clipboard.writeText(url);
      toast.show("Link copied to clipboard.");
    } catch { /* user cancelled share sheet — not an error */ }
  };

  const matchRows: [string, MatchResult["skills"] | MatchResult["experience"]][] = match
    ? [["Skills", match.skills], ["Experience", match.experience], ["Location", match.location], ["Education", match.education], ["Salary", match.salary], ["Job Type", match.jobType]]
    : [];

  return (
    <div className="page-shell narrow">
      <a className="back-link" href="#/jobs">← Back to search</a>
      <div className="job-detail-head">
        <div className="company-logo-sm">{job.company_logo ? <img src={job.company_logo} alt="" /> : "🏢"}</div>
        <div><h1>{job.title}</h1><p className="muted">{job.company_name} · {job.location || "Remote"}</p></div>
        {match && <MatchBadge score={match.overall} />}
      </div>
      <div className="job-detail-tags">
        <Badge>{(job.employment_type || "").replace("_", " ")}</Badge><Badge>{job.work_mode}</Badge>
        <Badge>{job.experience_level}</Badge><Badge tone="good">{formatKES(job.salary_min, job.salary_max)}</Badge>
      </div>
      <div className="job-detail-actions">
        <button className="btn ghost sm" onClick={save}>☆ Save Job</button>
        <button className="btn ghost sm" onClick={share}>↗ Share</button>
      </div>

      {match && (
        <div className="match-breakdown">
          <h3>Your Match</h3>
          <div className="match-rows">
            {matchRows.map(([label, m]) => (
              <div className="match-row" key={label}><span>{label}</span><ProgressBar value={m.score} tone={m.score >= 70 ? "good" : m.score >= 40 ? "warn" : "bad"} /><small>{m.label}</small></div>
            ))}
          </div>
          {match.reasons.length > 0 && (
            <>
              <h4>Why this job matches you</h4>
              <ul className="match-reasons">{match.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <section><h3>About the role</h3><p>{job.description}</p></section>
      {job.responsibilities && <section><h3>Responsibilities</h3><p>{job.responsibilities}</p></section>}
      {job.requirements && <section><h3>Requirements</h3><p>{job.requirements}</p></section>}
      {!!job.skills?.length && <section><h3>Skills</h3><div className="pill-row">{job.skills.map((s) => <Badge key={s.name}>{s.name}</Badge>)}</div></section>}
      {job.benefits && <section><h3>Benefits</h3><p>{job.benefits}</p></section>}
      <section><h3>About {job.company_name}</h3><a href={`#/companies/${job.company_id}`}>View company profile →</a></section>

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
