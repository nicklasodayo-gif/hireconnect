import { useEffect, useState } from "react";
import { companyApi } from "@/api";
import type { Company } from "@/types";
import { CompanyCard, JobCard } from "@/components";
import { Badge, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { navigate } from "@/hooks/useHashRoute";

export function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { companyApi.list(1).then((r) => setCompanies(r.companies)).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div className="page-shell">
      <h1>Discover companies</h1>
      {loading ? <Spinner /> : <div className="company-grid">{companies.map((c) => <CompanyCard key={c.id} company={c} />)}</div>}
    </div>
  );
}

export function CompanyDetail({ id }: { id: string }) {
  const [company, setCompany] = useState<Company | null>(null);
  const { user } = useAuth();
  const toast = useToast();
  useEffect(() => { companyApi.get(id).then(setCompany).catch(() => toast.show("Company not found.", "error")); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!company) return <div className="page-shell"><Spinner /></div>;

  const follow = async () => {
    if (!user) return navigate("/login");
    try { await companyApi.follow(id); toast.show("Following " + company.name); } catch (e) { toast.show(e instanceof Error ? e.message : "Couldn't follow company.", "error"); }
  };

  return (
    <div className="page-shell narrow">
      <div className="company-detail-head">
        <div className="company-logo">{company.logo_url ? <img src={company.logo_url} alt="" /> : "🏢"}</div>
        <div>
          <h1>{company.name} {!!company.verified && <Badge tone="good">✓ Verified Employer</Badge>}</h1>
          <p className="muted">{company.location} · {company.size} employees</p>
        </div>
        <button className="btn ghost" onClick={follow}>+ Follow</button>
      </div>
      <p>{company.description}</p>
      {company.culture && <section><h3>Culture</h3><p>{company.culture}</p></section>}
      {company.benefits && <section><h3>Benefits</h3><p>{company.benefits}</p></section>}
      <section>
        <h3>Open Positions ({company.openJobs?.length || 0})</h3>
        <div className="job-grid">
          {(company.openJobs || []).map((j) => <JobCard key={j.id} job={{ ...j, company_name: company.name, company_logo: company.logo_url }} />)}
        </div>
      </section>
    </div>
  );
}
