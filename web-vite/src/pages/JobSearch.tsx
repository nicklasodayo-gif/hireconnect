import { useCallback, useEffect, useState } from "react";
import { jobApi, savedSearchApi, type SavedSearch } from "@/api";
import type { Job } from "@/types";
import { JobCard } from "@/components";
import { EmptyState, Pagination, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { navigate, parseRoute, useHashRoute } from "@/hooks/useHashRoute";
import { EMPLOYMENT_TYPES } from "@/utils/format";

interface Filters {
  q: string; location: string; employmentType: string; workMode: string; experienceLevel: string; sort: string;
}

export function JobSearch() {
  const hash = useHashRoute();
  const { query } = parseRoute(hash);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    q: query.q || "", location: query.location || "", employmentType: "", workMode: "", experienceLevel: "", sort: "newest"
  });
  const { user } = useAuth();
  const toast = useToast();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  useEffect(() => { if (user?.role === "job_seeker") savedSearchApi.list().then((r) => setSavedSearches(r.searches)).catch(() => {}); }, [user]);

  const search = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v));
    jobApi.search(params)
      .then((r) => { setJobs(r.jobs); setTotal(r.total); })
      .catch(() => toast.show("Couldn't load jobs.", "error"))
      .finally(() => setLoading(false));
  }, [filters, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { search(); }, [search]);
  useEffect(() => { setPage(1); }, [filters]);

  const save = async (jobId: number) => {
    if (!user) return navigate("/login");
    try { await jobApi.save(jobId); toast.show("Job saved."); } catch (e) { toast.show(e instanceof Error ? e.message : "Failed to save job.", "error"); }
  };

  const saveThisSearch = async () => {
    if (!user) return navigate("/login");
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    if (Object.keys(activeFilters).length === 0) { toast.show("Add at least one filter before saving a search.", "error"); return; }
    try {
      const name = [filters.q, filters.location].filter(Boolean).join(" · ") || "Saved search";
      const created = await savedSearchApi.create(name, activeFilters);
      setSavedSearches((prev) => [created, ...prev]);
      toast.show("Search saved — you'll be able to revisit it here.", "success");
    } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't save search.", "error"); }
  };

  const applySavedSearch = (s: SavedSearch) => {
    setFilters({ q: s.query.q || "", location: s.query.location || "", employmentType: s.query.employmentType || "", workMode: s.query.workMode || "", experienceLevel: s.query.experienceLevel || "", sort: s.query.sort || "newest" });
  };

  const removeSavedSearch = async (id: number) => {
    try { await savedSearchApi.remove(id); setSavedSearches((prev) => prev.filter((s) => s.id !== id)); }
    catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't remove saved search.", "error"); }
  };

  return (
    <div className="page-shell">
      <h1>Find your next role</h1>
      <div className="filter-bar">
        <input placeholder="Job title or keyword" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        <input placeholder="Location (e.g. Nairobi)" value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} />
        <select value={filters.employmentType} onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}>
          <option value="">Any type</option>
          {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filters.workMode} onChange={(e) => setFilters((f) => ({ ...f, workMode: e.target.value }))}>
          <option value="">Remote/Hybrid/On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
        </select>
        <select value={filters.experienceLevel} onChange={(e) => setFilters((f) => ({ ...f, experienceLevel: e.target.value }))}>
          <option value="">Any experience</option><option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="executive">Executive</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
          <option value="newest">Newest</option><option value="salary">Highest salary</option>
        </select>
      </div>
      {user?.role === "job_seeker" && (
        <div className="saved-search-bar">
          <button className="btn ghost sm" onClick={saveThisSearch}>💾 Save this search</button>
          {savedSearches.length > 0 && (
            <div className="saved-search-chips">
              {savedSearches.map((s) => (
                <span key={s.id} className="saved-search-chip">
                  <button onClick={() => applySavedSearch(s)}>{s.name || "Saved search"}</button>
                  <button className="remove" onClick={() => removeSavedSearch(s.id)} aria-label="Remove saved search">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="muted">{loading ? "Searching…" : `${total} jobs found`}</p>
      {loading ? <Spinner /> : jobs.length === 0
        ? <EmptyState icon="🔍" title="No jobs match your filters" body="Try widening your search." />
        : <>
            <div className="job-grid">{jobs.map((j) => <JobCard key={j.id} job={j} onSave={save} />)}</div>
            <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
          </>}
    </div>
  );
}
