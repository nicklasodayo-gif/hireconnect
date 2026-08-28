import { useEffect, useState } from "react";
import { candidateApi } from "@/api";
import { API_BASE, getToken } from "@/api/client";
import type { CandidateProfile } from "@/types";
import { Avatar, Badge, Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";

export function CandidateProfileView({ id }: { id: string }) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const toast = useToast();
  useEffect(() => { candidateApi.get(id).then(setProfile).catch(() => toast.show("Candidate not found.", "error")); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!profile) return <div className="page-shell"><Spinner /></div>;

  const downloadCv = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/candidates/${id}/cv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "No CV on file for this candidate."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${profile.full_name}-cv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't download CV.", "error"); }
  };

  return (
    <div className="page-shell narrow">
      <div className="job-detail-head">
        <Avatar src={profile.photo_url} name={profile.full_name} size={56} />
        <div><h1>{profile.full_name}</h1><p className="muted">{profile.headline} · {profile.location}</p></div>
      </div>
      <div className="job-detail-actions">
        <button className="btn ghost sm" onClick={downloadCv}>⬇ Download CV</button>
      </div>
      {profile.bio && <section><h3>About</h3><p>{profile.bio}</p></section>}
      <section><h3>Skills</h3><div className="pill-row">{profile.skills.map((s) => <Badge key={s.name}>{s.name}</Badge>)}</div></section>
      <section>
        <h3>Experience</h3>
        {profile.experience.map((ex) => <div className="list-row" key={ex.id}><b>{ex.title}</b> — {ex.company}</div>)}
      </section>
      <section>
        <h3>Education</h3>
        {profile.education.map((ed) => <div className="list-row" key={ed.id}><b>{ed.degree}</b> — {ed.institution}</div>)}
      </section>
      {profile.portfolio_url && <section><h3>Portfolio</h3><a href={profile.portfolio_url} target="_blank" rel="noreferrer">{profile.portfolio_url}</a></section>}
    </div>
  );
}
