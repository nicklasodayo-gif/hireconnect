import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { companyApi, employerApi } from "@/api";
import type { Company } from "@/types";
import { Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";

type FormState = {
  name: string; description: string; website: string; location: string; size: string;
  foundedYear: string; culture: string; benefits: string;
};

const empty: FormState = { name: "", description: "", website: "", location: "", size: "", foundedYear: "", culture: "", benefits: "" };

export function CompanyForm() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    employerApi.myCompany()
      .then((r) => {
        if (r.company) {
          setCompanyId(r.company.id);
          setForm({
            name: r.company.name ?? "", description: r.company.description ?? "", website: r.company.website ?? "",
            location: r.company.location ?? "", size: r.company.size ?? "", foundedYear: r.company.founded_year ? String(r.company.founded_year) : "",
            culture: r.company.culture ?? "", benefits: r.company.benefits ?? ""
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined };
      if (companyId) { await companyApi.update(companyId, payload); toast.show("Company updated."); }
      else { const c = await companyApi.create(payload); setCompanyId(c.id); toast.show("Company created! Awaiting admin verification.", "success"); }
    } catch (err) { toast.show(err instanceof Error ? err.message : "Couldn't save company.", "error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell narrow">
      <h1>Company Profile</h1>
      <p className="muted">New companies are reviewed by our team before jobs go live — you can still save a draft now and post once approved.</p>
      <form className="card-form" onSubmit={submit}>
        <label>Company name<input required value={form.name} onChange={set("name")} /></label>
        <label>Description<textarea value={form.description} onChange={set("description")} /></label>
        <div className="form-row">
          <label>Website<input value={form.website} onChange={set("website")} /></label>
          <label>Location<input value={form.location} onChange={set("location")} /></label>
        </div>
        <div className="form-row">
          <label>Company size
            <select value={form.size} onChange={set("size")}>
              <option value="">—</option><option>1-10</option><option>11-50</option><option>51-200</option><option>201-500</option><option>500+</option>
            </select>
          </label>
          <label>Founded year<input type="number" value={form.foundedYear} onChange={set("foundedYear")} /></label>
        </div>
        <label>Culture<textarea value={form.culture} onChange={set("culture")} /></label>
        <label>Benefits<textarea value={form.benefits} onChange={set("benefits")} /></label>
        <button className="btn primary wide" disabled={saving}>{saving ? "Saving…" : companyId ? "Update Company" : "Create Company"}</button>
      </form>
    </div>
  );
}
