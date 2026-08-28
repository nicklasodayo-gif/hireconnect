import type { Interview } from "@/types";
import { Badge } from "@/components/ui";

const TYPE_ICON: Record<string, string> = { video: "🎥", phone: "📞", physical: "🏢", technical: "💻", hr: "🧑‍💼", panel: "👥" };

export function InterviewCard({ interview }: { interview: Interview }) {
  const when = new Date(interview.scheduled_at);
  return (
    <div className="interview-card">
      <div className="interview-card-icon">{TYPE_ICON[interview.type] || "📅"}</div>
      <div className="interview-card-body">
        <b>{interview.job_title || "Interview"}</b>
        {interview.candidate_name && <small>{interview.candidate_name}</small>}
        <small>{when.toLocaleString()}</small>
        {interview.location_or_link && <small className="muted">{interview.location_or_link}</small>}
      </div>
      <Badge tone={interview.status === "completed" ? "good" : interview.status === "cancelled" ? "bad" : "info"}>{interview.status}</Badge>
    </div>
  );
}
