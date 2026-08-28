import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { candidateApi } from "@/api";
import type { CandidateProfile } from "@/types";
import { TagInput } from "@/components";
import { Spinner } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { ProfileStrength } from "./Dashboard";
import { KENYAN_COUNTIES, normalizeKenyanPhone } from "@/utils/format";

type FormState = CandidateProfile & Record<string, unknown>;

export function ProfileEdit() {
  const toast = useToast();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [phoneWarning, setPhoneWarning] = useState("");
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", field: "", startYear: "", endYear: "" });
  const [expForm, setExpForm] = useState({ company: "", title: "" });

  const load = () => candidateApi.myProfile().then((p) => { setProfile(p); setForm(p as FormState); });
  useEffect(() => { load(); }, []);

  if (!profile || !form) return <div className="page-shell"><Spinner /></div>;
  const set = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const onPhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => (f ? { ...f, phone: value } : f));
    if (value && !normalizeKenyanPhone(value)) setPhoneWarning("Doesn't look like a valid Kenyan number (e.g. 0712 345 678 or +254712345678).");
    else setPhoneWarning("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const normalizedPhone = form.phone ? normalizeKenyanPhone(String(form.phone)) : null;
      await candidateApi.updateProfile({
        fullName: form.full_name, headline: form.headline ?? undefined, bio: form.bio ?? undefined,
        location: form.location ?? undefined, phone: normalizedPhone ?? String(form.phone ?? ""),
        yearsExperience: Number(form.years_experience) || 0, preferredJobType: form.preferred_job_type ?? undefined,
        preferredLocation: form.preferred_location ?? undefined, preferredWorkMode: form.preferred_work_mode ?? undefined,
        expectedSalaryMin: form.expected_salary_min ? Number(form.expected_salary_min) : undefined,
        expectedSalaryMax: form.expected_salary_max ? Number(form.expected_salary_max) : undefined,
        availability: form.availability ?? undefined, careerInterests: form.career_interests ?? undefined,
        linkedinUrl: form.linkedin_url ?? undefined, githubUrl: form.github_url ?? undefined, portfolioUrl: form.portfolio_url ?? undefined
      });
      toast.show("Profile saved.", "success");
      load();
    } catch (err) { toast.show(err instanceof Error ? err.message : "Couldn't save profile.", "error"); }
    finally { setSaving(false); }
  };

  const addSkill = (name: string) => candidateApi.addSkill(name).then(load).catch((e) => toast.show(e.message, "error"));
  const addEducation = (e: FormEvent) => {
    e.preventDefault();
    candidateApi.addEducation(eduForm).then(() => { load(); setEduForm({ institution: "", degree: "", field: "", startYear: "", endYear: "" }); })
      .catch((err) => toast.show(err.message, "error"));
  };
  const addExperience = (e: FormEvent) => {
    e.preventDefault();
    candidateApi.addExperience(expForm).then(() => { load(); setExpForm({ company: "", title: "" }); })
      .catch((err) => toast.show(err.message, "error"));
  };

  const onCvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      try { await candidateApi.uploadCv(file.name, base64); toast.show("CV uploaded."); load(); }
      catch (err) { toast.show(err instanceof Error ? err.message : "Couldn't upload CV.", "error"); }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="page-shell narrow">
      <h1>Your Profile</h1>
      <ProfileStrength profile={profile} />

      <form className="card-form" onSubmit={save}>
        <h3>About</h3>
        <label>Full name<input value={String(form.full_name ?? "")} onChange={set("full_name")} /></label>
        <label>Headline<input placeholder="e.g. Backend Engineer" value={String(form.headline ?? "")} onChange={set("headline")} /></label>
        <label>Bio<textarea value={String(form.bio ?? "")} onChange={set("bio")} /></label>
        <div className="form-row">
          <label>Location
            <select value={String(form.location ?? "")} onChange={set("location")}>
              <option value="">—</option>
              {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Phone
            <input value={String(form.phone ?? "")} onChange={onPhoneChange} placeholder="0712 345 678" />
            {phoneWarning && <small className="field-error">{phoneWarning}</small>}
          </label>
        </div>
        <label>Years of experience<input type="number" min="0" step="0.5" value={Number(form.years_experience ?? 0)} onChange={set("years_experience")} /></label>

        <h3>Preferences</h3>
        <div className="form-row">
          <label>Preferred job type
            <select value={String(form.preferred_job_type ?? "")} onChange={set("preferred_job_type")}>
              <option value="">—</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option>
              <option value="contract">Contract</option><option value="internship">Internship</option>
              <option value="attachment">Attachment</option><option value="graduate_trainee">Graduate Trainee</option>
              <option value="freelance">Freelance</option><option value="temporary">Temporary</option>
            </select>
          </label>
          <label>Preferred work mode
            <select value={String(form.preferred_work_mode ?? "")} onChange={set("preferred_work_mode")}>
              <option value="">—</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
            </select>
          </label>
        </div>
        <label>Preferred location
          <select value={String(form.preferred_location ?? "")} onChange={set("preferred_location")}>
            <option value="">—</option>
            {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="form-row">
          <label>Expected salary min (KES)<input type="number" value={Number(form.expected_salary_min ?? "") || ""} onChange={set("expected_salary_min")} /></label>
          <label>Expected salary max (KES)<input type="number" value={Number(form.expected_salary_max ?? "") || ""} onChange={set("expected_salary_max")} /></label>
        </div>
        <label>Availability
          <select value={String(form.availability ?? "")} onChange={set("availability")}>
            <option value="">—</option><option value="immediate">Immediate</option><option value="2_weeks">2 weeks notice</option>
            <option value="1_month">1 month notice</option><option value="negotiable">Negotiable</option>
          </select>
        </label>
        <label>Career interests<textarea value={String(form.career_interests ?? "")} onChange={set("career_interests")} /></label>

        <h3>Portfolio</h3>
        <label>LinkedIn<input value={String(form.linkedin_url ?? "")} onChange={set("linkedin_url")} /></label>
        <label>GitHub<input value={String(form.github_url ?? "")} onChange={set("github_url")} /></label>
        <label>Portfolio<input value={String(form.portfolio_url ?? "")} onChange={set("portfolio_url")} /></label>

        <button className="btn primary wide" disabled={saving}>{saving ? "Saving…" : "Save Profile"}</button>
      </form>

      <div className="card-form">
        <h3>Skills</h3>
        <TagInput items={profile.skills} onAdd={addSkill} placeholder="Add a skill (e.g. React)" />
      </div>

      <div className="card-form">
        <h3>Education</h3>
        {profile.education.map((ed) => <div className="list-row" key={ed.id}><b>{ed.degree}</b> — {ed.institution} <span className="muted">({ed.start_year}–{ed.end_year || "present"})</span></div>)}
        <form className="form-row" onSubmit={addEducation}>
          <input placeholder="Institution" required value={eduForm.institution} onChange={(e) => setEduForm((f) => ({ ...f, institution: e.target.value }))} />
          <input placeholder="Degree" required value={eduForm.degree} onChange={(e) => setEduForm((f) => ({ ...f, degree: e.target.value }))} />
          <input placeholder="Start year" value={eduForm.startYear} onChange={(e) => setEduForm((f) => ({ ...f, startYear: e.target.value }))} />
          <input placeholder="End year" value={eduForm.endYear} onChange={(e) => setEduForm((f) => ({ ...f, endYear: e.target.value }))} />
          <button className="btn subtle">Add</button>
        </form>
      </div>

      <div className="card-form">
        <h3>Experience</h3>
        {profile.experience.map((ex) => <div className="list-row" key={ex.id}><b>{ex.title}</b> — {ex.company}</div>)}
        <form className="form-row" onSubmit={addExperience}>
          <input placeholder="Company" required value={expForm.company} onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))} />
          <input placeholder="Title" required value={expForm.title} onChange={(e) => setExpForm((f) => ({ ...f, title: e.target.value }))} />
          <button className="btn subtle">Add</button>
        </form>
      </div>

      <div className="card-form">
        <h3>CV</h3>
        <p className="muted">{profile.cv_path ? "CV on file ✓" : "No CV uploaded yet."}</p>
        <input type="file" accept=".pdf,.doc,.docx" onChange={onCvFile} />
      </div>
    </div>
  );
}
