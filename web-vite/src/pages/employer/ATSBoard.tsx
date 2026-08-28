import { useEffect, useState, type DragEvent } from "react";
import { applicationApi } from "@/api";
import type { Application, ApplicationStatus } from "@/types";
import { Avatar, EmptyState, MatchBadge, Spinner, StatusPill } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { ApplicationDetailModal, ATS_COLUMNS } from "./ApplicationDetailModal";

export function ATSBoard() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ApplicationStatus | null>(null);
  const toast = useToast();

  const load = () => applicationApi.list().then((r) => setApps(r.applications));
  useEffect(() => { load(); }, []);
  if (!apps) return <div className="page-shell"><Spinner /></div>;

  const onDragStart = (e: DragEvent<HTMLButtonElement>, id: number) => {
    e.dataTransfer.setData("text/plain", String(id));
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>, status: ApplicationStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const idStr = e.dataTransfer.getData("text/plain");
    const id = Number(idStr);
    if (!id) return;
    const current = apps.find((a) => a.id === id);
    if (!current || current.status === status) return;
    // Optimistic update so the drag feels instant, then persist — reload
    // on failure so the board never silently drifts from the database.
    setApps((prev) => prev && prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await applicationApi.setStatus(id, status);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Couldn't move candidate — reverting.", "error");
      load();
    }
  };

  return (
    <div className="page-shell wide">
      <h1>Applicant Tracking</h1>
      {apps.length === 0 ? <EmptyState icon="🗂️" title="No applicants yet" body="Applications to your jobs will appear here." /> : (
        <div className="ats-board">
          {ATS_COLUMNS.map((status) => (
            <div
              className={`ats-column ${dragOverColumn === status ? "drag-over" : ""}`}
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(status); }}
              onDragLeave={() => setDragOverColumn((s) => (s === status ? null : s))}
              onDrop={(e) => onDrop(e, status)}
            >
              <div className="ats-column-head"><StatusPill status={status} /><span>{apps.filter((a) => a.status === status).length}</span></div>
              {apps.filter((a) => a.status === status).map((a) => (
                <button className="ats-card" key={a.id} draggable onDragStart={(e) => onDragStart(e, a.id)} onClick={() => setOpenId(a.id)}>
                  <div className="ats-card-top"><Avatar src={a.candidate_photo} name={a.candidate_name || "?"} size={28} /><b>{a.candidate_name}</b></div>
                  <small className="muted">{a.job_title}</small>
                  {a.match_score != null && <MatchBadge score={a.match_score} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {openId && <ApplicationDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
