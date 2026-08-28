import { useEffect, useState } from "react";
import { applicationApi } from "@/api";
import type { Application, ApplicationStatus } from "@/types";
import { ApplicationCard } from "@/components";
import { EmptyState, Spinner, StatusPill } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { STATUS_ORDER } from "@/utils/format";

export function ApplicationsTracker() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const toast = useToast();
  const load = () => applicationApi.list().then((r) => setApps(r.applications));
  useEffect(() => { load(); }, []);

  if (!apps) return <div className="page-shell"><Spinner /></div>;

  const withdraw = async (id: number) => {
    try { await applicationApi.withdraw(id); toast.show("Application withdrawn."); load(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't withdraw application.", "error"); }
  };

  const groups = (STATUS_ORDER as ApplicationStatus[]).concat(["rejected", "withdrawn"])
    .map((status) => ({ status, items: apps.filter((a) => a.status === status) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="page-shell">
      <h1>Your Applications</h1>
      {apps.length === 0 ? (
        <EmptyState icon="📋" title="No applications yet" body="Applications you submit will show up here." action={<a className="btn primary" href="#/jobs">Browse jobs</a>} />
      ) : (
        <div className="tracker">
          {groups.map((g) => (
            <div className="tracker-group" key={g.status}>
              <div className="tracker-head"><StatusPill status={g.status} /><span>{g.items.length}</span></div>
              {g.items.map((a) => <ApplicationCard key={a.id} application={a} onWithdraw={withdraw} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
