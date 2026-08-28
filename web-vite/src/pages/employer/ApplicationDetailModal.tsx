import { useEffect, useState, type FormEvent } from "react";
import { applicationApi, interviewApi, messageApi } from "@/api";
import { API_BASE, getToken } from "@/api/client";
import type { Application, ApplicationStatus, InterviewType } from "@/types";
import { Modal, StatusPill } from "@/components/ui";
import { MatchBadge } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { navigate } from "@/hooks/useHashRoute";
import { timeAgo } from "@/utils/format";

const ATS_COLUMNS: ApplicationStatus[] = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected"];
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn"
};

export function ApplicationDetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [app, setApp] = useState<Application | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [interview, setInterview] = useState<{ scheduledAt: string; type: InterviewType; locationOrLink: string }>({ scheduledAt: "", type: "video", locationOrLink: "" });
  const toast = useToast();

  const load = () => applicationApi.get(id).then(setApp);
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!app) return <Modal title="Application" onClose={onClose}><p className="muted">Loading…</p></Modal>;

  const changeStatus = async (status: ApplicationStatus) => {
    try { await applicationApi.setStatus(id, status); load(); onChanged(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't update status.", "error"); }
  };
  const addNote = async (e: FormEvent) => {
    e.preventDefault(); if (!note.trim()) return;
    try { await applicationApi.addNote(id, note); setNote(""); load(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't add note.", "error"); }
  };
  const rate = async (n: number) => {
    setRating(n);
    try { await applicationApi.rate(id, n); } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't rate candidate.", "error"); }
  };
  const scheduleInterview = async (e: FormEvent) => {
    e.preventDefault();
    try { await interviewApi.create({ applicationId: id, ...interview }); toast.show("Interview scheduled."); load(); onChanged(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't schedule interview.", "error"); }
  };
  const message = async () => {
    try { await messageApi.start(id); navigate("/employer/messages"); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't start conversation.", "error"); }
  };
  const downloadCv = async () => {
    try {
      const token = getToken();
      const candidateId = app.candidate_profile_id ?? app.candidate_id;
      const res = await fetch(`${API_BASE}/api/candidates/${candidateId}/cv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "No CV on file for this candidate."); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${app.candidate_name || "candidate"}-cv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't download CV.", "error"); }
  };

  return (
    <Modal title={app.candidate_name || "Candidate"} onClose={onClose} width="640px">
      <div className="app-detail">
        <div className="app-detail-top">
          <div>
            <b>{app.job_title}</b>
            <small className="muted"> — applied {timeAgo(app.applied_at)}</small>
          </div>
          <MatchBadge score={app.match_score} />
        </div>
        <div className="status-actions">
          {ATS_COLUMNS.map((s) => (
            <button key={s} className={`btn sm ${app.status === s ? "primary" : "ghost"}`} onClick={() => changeStatus(s)}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
        <div className="star-row">
          Rate candidate: {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`star ${(rating || app.rating || 0) >= n ? "on" : ""}`} onClick={() => rate(n)}>★</span>
          ))}
        </div>
        <div className="row-actions">
          {app.candidate_profile_id && <a className="btn subtle sm" href={`#/employer/candidates/${app.candidate_profile_id}`}>👤 View full profile</a>}
          <button className="btn subtle sm" onClick={message}>💬 Message candidate</button>
          <button className="btn subtle sm" onClick={downloadCv}>⬇ Download CV</button>
        </div>

        <h4>Schedule interview</h4>
        <form className="form-row" onSubmit={scheduleInterview}>
          <input type="datetime-local" required onChange={(e) => setInterview((i) => ({ ...i, scheduledAt: e.target.value }))} />
          <select value={interview.type} onChange={(e) => setInterview((i) => ({ ...i, type: e.target.value as InterviewType }))}>
            <option value="video">Video</option><option value="phone">Phone</option><option value="physical">Physical</option>
            <option value="technical">Technical</option><option value="hr">HR</option><option value="panel">Panel</option>
          </select>
          <input placeholder="Location or link" onChange={(e) => setInterview((i) => ({ ...i, locationOrLink: e.target.value }))} />
          <button className="btn subtle sm">Schedule</button>
        </form>

        <h4>Notes</h4>
        <div className="notes-list">{(app.notes ?? []).map((n) => <div className="note-item" key={n.id}>{n.note}</div>)}</div>
        <form className="inline-add" onSubmit={addNote}>
          <input placeholder="Add an internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn subtle">Add</button>
        </form>

        <h4>History</h4>
        <div className="history-list">
          {(app.history ?? []).map((h) => <div key={h.id} className="history-item"><StatusPill status={h.status} /><small>{timeAgo(h.created_at)}</small></div>)}
        </div>
      </div>
    </Modal>
  );
}

export { ATS_COLUMNS };
