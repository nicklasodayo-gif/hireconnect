import { useEffect, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { jobApi } from "@/api";
import { TagInput } from "@/components";
import { navigate } from "@/hooks/useHashRoute";
import { useToast } from "@/context/ToastContext";
import { EMPLOYMENT_TYPES } from "@/utils/format";

interface FormState {
  title: string; department: string; description: string; responsibilities: string; requirements: string;
  experienceLevel: string; educationRequirement: string; employmentType: string; workMode: string; location: string;
  salaryMin: string; salaryMax: string; benefits: string; openings: string; applicationDeadline: string; skills: string[];
}

const empty: FormState = {
  title: "", department: "", description: "", responsibilities: "", requirements: "",
  experienceLevel: "mid", educationRequirement: "", employmentType: "full_time", workMode: "onsite", location: "",
  salaryMin: "", salaryMax: "", benefits: "", openings: "1", applicationDeadline: "", skills: []
};

export function JobPostingForm({ jobId }: { jobId?: string }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    jobApi.get(jobId).then((j) => setForm({
      title: j.title, department: j.department ?? "", description: j.description, responsibilities: j.responsibilities ?? "",
      requirements: j.requirements ?? "", experienceLevel: j.experience_level, educationRequirement: j.education_requirement ?? "",
      employmentType: j.employment_type, workMode: j.work_mode, location: j.location ?? "",
      salaryMin: j.salary_min != null ? String(j.salary_min) : "", salaryMax: j.salary_max != null ? String(j.salary_max) : "",
      benefits: j.benefits ?? "", openings: String(j.openings ?? 1), applicationDeadline: j.application_deadline ?? "",
      skills: (j.skills ?? []).map((s) => s.name)
    }));
  }, [jobId]);

  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: MouseEvent | FormEvent, publish: boolean) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, status: publish ? ("published" as const) : ("draft" as const) };
      if (jobId) {
        await jobApi.update(jobId, payload);
        if (publish) await jobApi.publish(jobId);
      } else {
        await jobApi.create(payload);
      }
      toast.show(publish ? "Job published!" : "Draft saved.", "success");
      navigate("/employer/jobs");
    } catch (err) { toast.show(err instanceof Error ? err.message : "Couldn't save job.", "error"); }
    finally { setSaving(false); }
  };

  const addSkill = (name: string) => setForm((f) => (f.skills.includes(name) ? f : { ...f, skills: [...f.skills, name] }));

  return (
    <div className="page-shell narrow">
      <h1>{jobId ? "Edit Job" : "Post a New Job"}</h1>
      <form className="card-form">
        <label>Job title<input required value={form.title} onChange={set("title")} /></label>
        <label>Department<input value={form.department} onChange={set("department")} /></label>
        <label>Description<textarea required value={form.description} onChange={set("description")} /></label>
        <label>Responsibilities<textarea value={form.responsibilities} onChange={set("responsibilities")} /></label>
        <label>Requirements<textarea value={form.requirements} onChange={set("requirements")} /></label>
        <div className="form-row">
          <label>Experience level
            <select value={form.experienceLevel} onChange={set("experienceLevel")}>
              <option value="entry">Entry</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="executive">Executive</option>
            </select>
          </label>
          <label>Education requirement
            <select value={form.educationRequirement} onChange={set("educationRequirement")}>
              <option value="">None specified</option><option value="certificate">Certificate</option><option value="diploma">Diploma</option>
              <option value="bachelor">Bachelor's</option><option value="master">Master's</option><option value="phd">PhD</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Employment type
            <select value={form.employmentType} onChange={set("employmentType")}>
              {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label>Work mode
            <select value={form.workMode} onChange={set("workMode")}>
              <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
            </select>
          </label>
        </div>
        <label>Location<input value={form.location} onChange={set("location")} /></label>
        <div className="form-row">
          <label>Salary min (KES)<input type="number" value={form.salaryMin} onChange={set("salaryMin")} /></label>
          <label>Salary max (KES)<input type="number" value={form.salaryMax} onChange={set("salaryMax")} /></label>
        </div>
        <label>Benefits<textarea value={form.benefits} onChange={set("benefits")} /></label>
        <div className="form-row">
          <label>Number of openings<input type="number" min="1" value={form.openings} onChange={set("openings")} /></label>
          <label>Application deadline<input type="date" value={form.applicationDeadline} onChange={set("applicationDeadline")} /></label>
        </div>
        <div>
          <label>Required skills</label>
          <TagInput items={form.skills} onAdd={addSkill} placeholder="Add a required skill" />
        </div>
        <div className="form-row">
          <button className="btn ghost wide" disabled={saving} onClick={(e) => submit(e, false)}>Save Draft</button>
          <button className="btn primary wide" disabled={saving} onClick={(e) => submit(e, true)}>Publish Job</button>
        </div>
      </form>
    </div>
  );
}
