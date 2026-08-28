import type { Company } from "@/types";
import { Badge } from "@/components/ui";

export function CompanyCard({ company }: { company: Company }) {
  return (
    <a className="company-card" href={`#/companies/${company.id}`}>
      <div className="company-logo">{company.logo_url ? <img src={company.logo_url} alt="" /> : "🏢"}</div>
      <b>{company.name}</b>
      <small>{company.location}</small>
      {!!company.verified && <Badge tone="good">✓ Verified Employer</Badge>}
    </a>
  );
}
