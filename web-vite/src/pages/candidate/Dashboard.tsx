import { useEffect, useState } from "react";
import { candidateApi, jobApi, applicationApi } from "@/api";
import type { Application, CandidateProfile, Job } from "@/types";
import { JobCard } from "@/components";
import { EmptyState, ProgressBar, Spinner } from "@/components/ui";

export function ProfileStrength({ profile }: { profile: CandidateProfile }) {
  return (
    <div className="strength-card">
      <div className="strength-head"><b>Profile Strength</b><span>{profile.profile_completion}%</span></div>
      <ProgressBar value={profile.profile_completion} tone={profile.profile_completion >= 70 ? "good" : "warn"} />
      {profile.missing.length > 0 && <ul className="missing-list">{profile.missing.slice(0, 3).map((m) => <li key={m}>{m}</li>)}</ul>}
    </div>
  );
}

export function CandidateDashboard() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [recommended, setRecommended] = useState<Job[]>([]);
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    candidateApi.myProfile().then(setProfile).catch(() => {});
    jobApi.recommended().then((r) => setRecommended(r.jobs.slice(0, 4))).catch(() => {});
    applicationApi.list().then((r) => setApps(r.applications)).catch(() => {});
  }, []);

  if (!profile) return <div className="page-shell"><Spinner /></div>;
  const active = apps.filter((a) => !["rejected", "withdrawn"].includes(a.status)).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="page-shell">
      <h1>{greeting}, {profile.full_name?.split(" ")[0] || "there"} 👋</h1>
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
      {recommended.length === 0
        ? <EmptyState icon="✨" title="Complete your profile" body="Add skills and preferences to get personalized recommendations." action={<a className="btn primary" href="#/profile">Edit profile</a>} />
        : <div className="job-grid">{recommended.map((j) => <JobCard key={j.id} job={j} />)}</div>}
      <div className="quick-links">
        <a className="quick-link" href="#/applications">📋 Track Applications</a>
        <a className="quick-link" href="#/saved">☆ Saved Jobs</a>
        <a className="quick-link" href="#/profile">👤 Edit Profile</a>
        <a className="quick-link" href="#/messages">💬 Messages</a>
      </div>
    </div>
  );
}
