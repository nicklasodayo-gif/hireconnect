import { useEffect, useState, type FormEvent } from "react";
import { jobApi, companyApi } from "@/api";
import type { Job, Company } from "@/types";
import { JobCard, CompanyCard } from "@/components";
import { Spinner } from "@/components/ui";

function HeroVisual() {
  return (
    <div className="hero-visual">
      <div className="hv-card hv-candidate"><div className="hv-avatar">👩🏾‍💻</div><div><b>Amina K.</b><small>Backend Engineer</small></div></div>
      <div className="hv-card hv-job"><div className="hv-logo">🏢</div><div><b>Senior Backend Engineer</b><small>Twiga Digital Solutions</small></div></div>
      <svg className="hv-connector" viewBox="0 0 200 80"><path d="M10 20 C 80 20, 80 60, 190 60" /></svg>
      <div className="hv-score">92% <span>Match</span></div>
    </div>
  );
}

function StatStrip() {
  const [stats, setStats] = useState<{ jobs: number; companies: number } | null>(null);
  useEffect(() => {
    Promise.all([jobApi.search({ page: "1" }), companyApi.list(1)])
      .then(([jobs, companies]) => setStats({ jobs: jobs.total, companies: companies.companies.length }))
      .catch(() => {});
  }, []);
  return (
    <div className="stat-strip">
      <div><b>{stats ? `${stats.jobs}+` : "—"}</b><span>Active jobs</span></div>
      <div><b>{stats ? `${stats.companies}+` : "—"}</b><span>Companies hiring</span></div>
      <div><b>KES</b><span>Local salary ranges</span></div>
      <div><b>Nairobi &amp; beyond</b><span>Kenya-wide opportunities</span></div>
    </div>
  );
}

function HeroSearch() {
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); window.location.hash = `/jobs?q=${encodeURIComponent(q)}`; };
  return (
    <form className="hero-search" onSubmit={submit}>
      <input placeholder="Job title, skill, or company" value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="btn primary" type="submit">Search Jobs</button>
    </form>
  );
}

export function Landing() {
  const [popular, setPopular] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      jobApi.search({ sort: "newest" }).then((r) => setPopular(r.jobs.slice(0, 6))).catch(() => {}),
      companyApi.list(1).then((r) => setCompanies(r.companies.slice(0, 6))).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const categories = ["Software Engineering", "Product & Design", "Sales & Marketing", "Finance & Accounting", "Data & Analytics", "Operations & Logistics"];

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">✦ KENYA'S MODERN RECRUITMENT PLATFORM</div>
          <h1>Find Work.<br />Find Talent.<br /><em>Build What's Next.</em></h1>
          <p>HireConnect connects ambitious professionals with companies looking for the right talent — with transparent, explainable job matching.</p>
          <HeroSearch />
          <div className="hero-cta">
            <a className="btn primary huge" href="#/jobs">Find Jobs</a>
            <a className="btn ghost huge" href="#/register">Hire Talent</a>
          </div>
        </div>
        <HeroVisual />
      </section>
      <StatStrip />

      <section className="section">
        <div className="section-head"><h2>Popular Jobs</h2><a href="#/jobs">See all jobs →</a></div>
        {loading ? <Spinner /> : <div className="job-grid">{popular.map((j) => <JobCard key={j.id} job={j} />)}</div>}
      </section>

      <section className="section alt">
        <div className="section-head"><h2>Top Companies Hiring</h2><a href="#/companies">See all companies →</a></div>
        <div className="company-grid">{companies.map((c) => <CompanyCard key={c.id} company={c} />)}</div>
      </section>

      <section className="section">
        <div className="section-head"><h2>How HireConnect Works</h2></div>
        <div className="how-grid">
          <div className="how-step"><div className="how-num">01</div><h3>Create your profile</h3><p>Add your skills, experience and preferences once — it powers every match.</p></div>
          <div className="how-step"><div className="how-num">02</div><h3>Get matched</h3><p>See a transparent match score for every job, with a clear breakdown of why.</p></div>
          <div className="how-step"><div className="how-num">03</div><h3>Apply &amp; track</h3><p>Apply in one click and follow your application from submitted to hired.</p></div>
        </div>
      </section>

      <section className="section alt">
        <div className="section-head"><h2>Why HireConnect</h2></div>
        <div className="how-grid">
          <div className="how-step"><h3>🔍 Transparent matching</h3><p>Every match shows exactly why — no black-box "AI" claims for a rule-based score.</p></div>
          <div className="how-step"><h3>🇰🇪 Built for Kenya</h3><p>KES salaries, county-level locations, and job types like Attachment and Graduate Trainee.</p></div>
          <div className="how-step"><h3>✓ Verified employers</h3><p>Companies are reviewed before their jobs go live, with a visible verification badge.</p></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Explore by Category</h2></div>
        <div className="category-grid">
          {categories.map((c) => <a key={c} className="category-chip" href={`#/jobs?category=${encodeURIComponent(c)}`}>{c}</a>)}
        </div>
      </section>

      <section className="section alt">
        <div className="section-head"><h2>Success Stories</h2></div>
        <div className="story-grid">
          <div className="story-card">"I found a backend role in three weeks — the match breakdown told me exactly why I was a fit before I even applied." <b>— Wanjiru M., Software Engineer</b></div>
          <div className="story-card">"As a recruiter, the ATS pipeline saved us hours every week screening candidates." <b>— Otieno A., Talent Lead</b></div>
          <div className="story-card">"HireConnect's salary transparency in KES made negotiating so much easier." <b>— Achieng W., Product Designer</b></div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to build what's next?</h2>
        <div className="hero-cta">
          <a className="btn primary huge" href="#/register">Find Jobs</a>
          <a className="btn ghost huge inverted" href="#/register">Hire Talent</a>
        </div>
      </section>
    </div>
  );
}
