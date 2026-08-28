import type { Application } from "@/types";
import { MatchBadge, StatusPill } from "@/components/ui";
import { timeAgo } from "@/utils/format";

export interface ApplicationCardProps {
  application: Application;
  onWithdraw?: (id: number) => void;
}

export function ApplicationCard({ application: a, onWithdraw }: ApplicationCardProps) {
  const canWithdraw = ["applied", "screening", "shortlisted"].includes(a.status);
  return (
    <div className="tracker-card">
      <div>
        <b>{a.job_title}</b>
        <small>{a.company_name} · applied {timeAgo(a.applied_at)}</small>
      </div>
      <div className="tracker-right">
        <StatusPill status={a.status} />
        {a.match_score != null && <MatchBadge score={a.match_score} />}
        {onWithdraw && canWithdraw && <button className="btn ghost sm" onClick={() => onWithdraw(a.id)}>Withdraw</button>}
      </div>
    </div>
  );
}
