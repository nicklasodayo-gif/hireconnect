import { useEffect, useState } from "react";
import { jobApi } from "@/api";
import type { Job } from "@/types";
import { JobCard } from "@/components";
import { EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";

export function SavedJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const toast = useToast();
  const load = () => jobApi.saved().then((r) => setJobs(r.jobs));
  useEffect(() => { load(); }, []);
  if (!jobs) return <div className="page-shell"><Spinner /></div>;

  const unsave = async (jobId: number) => {
    try { await jobApi.unsave(jobId); toast.show("Removed from saved jobs."); load(); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't remove job.", "error"); }
  };

  return (
    <div className="page-shell">
      <h1>Saved Jobs</h1>
      {jobs.length === 0 ? <EmptyState icon="☆" title="No saved jobs yet" body="Save jobs while browsing to find them here later." /> : (
        <div className="job-grid">
          {jobs.map((j) => (
            <div key={j.id}>
              <JobCard job={j} />
              <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => unsave(j.id)}>Remove from saved</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
