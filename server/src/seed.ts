import { openDb } from "./db.ts";
import { hashPassword } from "./auth.ts";
import { calculateMatch } from "./matching.ts";

const DB_PATH = process.env.DB_PATH ?? "./hireconnect.db";
// Configurable so the same literal string isn't hardcoded in source for
// every clone of the repo — override with real values for anything beyond
// local/demo use.
const SEED_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "AdminPass123!";
const db = openDb(DB_PATH);

function upsertSkill(name: string): number {
  const existing = db.prepare(`SELECT id FROM skills WHERE name = ?`).get(name) as any;
  if (existing) return existing.id;
  return Number(db.prepare(`INSERT INTO skills (name) VALUES (?)`).run(name).lastInsertRowid);
}

const INDUSTRIES = ["Technology", "Finance & Banking", "Healthcare", "Manufacturing", "Agriculture", "Telecommunications", "Retail & E-commerce", "Logistics", "Media & Communications", "Education"];
const CATEGORIES = ["Software Engineering", "Product & Design", "Sales & Marketing", "Finance & Accounting", "Customer Support", "Human Resources", "Operations & Logistics", "Data & Analytics", "Media & Communications"];

console.log("Seeding HireConnect demo data...");

for (const name of INDUSTRIES) db.prepare(`INSERT OR IGNORE INTO industries (name) VALUES (?)`).run(name);
for (const name of CATEGORIES) db.prepare(`INSERT OR IGNORE INTO job_categories (name) VALUES (?)`).run(name);

const SKILL_NAMES = ["JavaScript", "TypeScript", "React", "Node.js", "Python", "Django", "SQL", "PostgreSQL", "AWS", "Docker",
  "Kubernetes", "Java", "Spring Boot", "Figma", "UI Design", "UX Research", "Digital Marketing", "SEO", "Content Writing",
  "Sales", "Negotiation", "Excel", "Financial Modeling", "Accounting", "QuickBooks", "Customer Service", "Zendesk",
  "Recruitment", "HR Policy", "Supply Chain", "Logistics Planning", "Data Analysis", "Power BI", "Machine Learning", "Mobile App Development", "Kotlin", "Swift", "PHP", "Laravel", "WordPress"];
const skillId: Record<string, number> = {};
for (const s of SKILL_NAMES) skillId[s] = upsertSkill(s);

const COMPANIES = [
  { name: "Twiga Digital Solutions", industry: "Technology", location: "Nairobi, Kenya", size: "51-200", founded: 2015, desc: "A fast-growing fintech and e-commerce technology company building for the East African market.", culture: "Fast-paced, remote-friendly, engineering-led.", benefits: "Health insurance, learning budget, hybrid work." },
  { name: "Savannah Bank Kenya", industry: "Finance & Banking", location: "Nairobi, Kenya", size: "500+", founded: 1998, desc: "A leading retail and corporate bank serving individuals and SMEs across Kenya.", culture: "Structured, professional, growth-oriented.", benefits: "Pension, medical cover, staff loans." },
  { name: "Maisha Health Group", industry: "Healthcare", location: "Nairobi, Kenya", size: "201-500", founded: 2008, desc: "A network of modern hospitals and clinics across Kenya focused on accessible quality care.", culture: "Mission-driven, collaborative.", benefits: "Medical cover, housing allowance." },
  { name: "Rift Valley Foods", industry: "Manufacturing", location: "Nakuru, Kenya", size: "201-500", founded: 2001, desc: "A leading food processing and manufacturing company supplying supermarkets across East Africa.", culture: "Hands-on, safety-first.", benefits: "Transport allowance, medical cover." },
  { name: "Shamba Agrotech", industry: "Agriculture", location: "Eldoret, Kenya", size: "51-200", founded: 2018, desc: "Agri-tech company helping smallholder farmers access markets and financing.", culture: "Impact-driven, field-based teams.", benefits: "Field allowance, medical cover." },
  { name: "Safarilink Telecom", industry: "Telecommunications", location: "Nairobi, Kenya", size: "500+", founded: 1999, desc: "A major telecommunications provider delivering mobile, data and enterprise connectivity.", culture: "Innovation-focused, large engineering org.", benefits: "Data allowance, medical cover, pension." },
  { name: "Duka Online", industry: "Retail & E-commerce", location: "Nairobi, Kenya", size: "51-200", founded: 2019, desc: "An online marketplace connecting Kenyan sellers with buyers nationwide.", culture: "Scrappy, customer-obsessed startup.", benefits: "Equity options, flexible hours." },
  { name: "Pwani Logistics", industry: "Logistics", location: "Mombasa, Kenya", size: "201-500", founded: 2005, desc: "Freight, warehousing and last-mile delivery across the East African corridor.", culture: "Operational excellence, safety-first.", benefits: "Medical cover, transport allowance." },
  { name: "Baraza Media House", industry: "Media & Communications", location: "Nairobi, Kenya", size: "51-200", founded: 2012, desc: "A digital-first media company producing news, podcasts and branded content.", culture: "Creative, deadline-driven.", benefits: "Flexible hours, equipment budget." },
  { name: "Elimu EdTech", industry: "Education", location: "Nairobi, Kenya", size: "11-50", founded: 2020, desc: "Building affordable digital learning tools for Kenyan primary and secondary schools.", culture: "Mission-driven, small close-knit team.", benefits: "Learning budget, flexible hours." }
];

const industryId = (name: string) => (db.prepare(`SELECT id FROM industries WHERE name = ?`).get(name) as any).id;
const categoryId = (name: string) => (db.prepare(`SELECT id FROM job_categories WHERE name = ?`).get(name) as any).id;

const companyIds: number[] = [];
COMPANIES.forEach((c, i) => {
  const email = `employer${i + 1}@${c.name.toLowerCase().replace(/[^a-z]+/g, "")}.co.ke`;
  const userInfo = db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, role, email_verified, status) VALUES (?,?,?,1,'active')`)
    .run(email, hashPassword(SEED_PASSWORD), "employer");
  const userId = userInfo.lastInsertRowid ? Number(userInfo.lastInsertRowid) : (db.prepare(`SELECT id FROM users WHERE email=?`).get(email) as any).id;
  db.prepare(`INSERT OR IGNORE INTO employer_profiles (user_id) VALUES (?)`).run(userId);
  const compInfo = db.prepare(
    `INSERT INTO companies (owner_user_id, name, description, industry_id, location, size, founded_year, culture, benefits, verified, status)
     VALUES (?,?,?,?,?,?,?,?,?,1,'approved')`
  ).run(userId, c.name, c.desc, industryId(c.industry), c.location, c.size, c.founded, c.culture, c.benefits);
  const companyId = Number(compInfo.lastInsertRowid);
  db.prepare(`UPDATE employer_profiles SET company_id = ? WHERE user_id = ?`).run(companyId, userId);
  companyIds.push(companyId);
});

const JOB_TEMPLATES = [
  { title: "Senior Backend Engineer", category: "Software Engineering", level: "senior", type: "full_time", mode: "hybrid", loc: "Nairobi, Kenya", salary: [220000, 320000], skills: ["Node.js", "TypeScript", "PostgreSQL", "AWS", "Docker"], edu: "bachelor" },
  { title: "Frontend Developer (React)", category: "Software Engineering", level: "mid", type: "full_time", mode: "remote", loc: "Nairobi, Kenya", salary: [140000, 200000], skills: ["React", "JavaScript", "TypeScript"], edu: "bachelor" },
  { title: "Mobile App Developer", category: "Software Engineering", level: "mid", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [150000, 210000], skills: ["Kotlin", "Swift", "Mobile App Development"], edu: "bachelor" },
  { title: "Product Designer", category: "Product & Design", level: "mid", type: "full_time", mode: "hybrid", loc: "Nairobi, Kenya", salary: [130000, 190000], skills: ["Figma", "UI Design", "UX Research"], edu: "bachelor" },
  { title: "Digital Marketing Specialist", category: "Sales & Marketing", level: "entry", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [70000, 110000], skills: ["Digital Marketing", "SEO", "Content Writing"], edu: "diploma" },
  { title: "Sales Executive", category: "Sales & Marketing", level: "entry", type: "full_time", mode: "onsite", loc: "Mombasa, Kenya", salary: [60000, 100000], skills: ["Sales", "Negotiation"], edu: "diploma" },
  { title: "Financial Analyst", category: "Finance & Accounting", level: "mid", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [120000, 170000], skills: ["Financial Modeling", "Excel", "Accounting"], edu: "bachelor" },
  { title: "Accountant", category: "Finance & Accounting", level: "mid", type: "full_time", mode: "onsite", loc: "Nakuru, Kenya", salary: [90000, 130000], skills: ["Accounting", "QuickBooks", "Excel"], edu: "bachelor" },
  { title: "Customer Support Representative", category: "Customer Support", level: "entry", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [45000, 70000], skills: ["Customer Service", "Zendesk"], edu: "diploma" },
  { title: "HR Officer", category: "Human Resources", level: "mid", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [90000, 130000], skills: ["Recruitment", "HR Policy"], edu: "bachelor" },
  { title: "Supply Chain Coordinator", category: "Operations & Logistics", level: "mid", type: "full_time", mode: "onsite", loc: "Mombasa, Kenya", salary: [100000, 150000], skills: ["Supply Chain", "Logistics Planning"], edu: "bachelor" },
  { title: "Data Analyst", category: "Data & Analytics", level: "mid", type: "full_time", mode: "hybrid", loc: "Nairobi, Kenya", salary: [130000, 190000], skills: ["SQL", "Data Analysis", "Power BI"], edu: "bachelor" },
  { title: "Machine Learning Engineer", category: "Data & Analytics", level: "senior", type: "full_time", mode: "remote", loc: "Nairobi, Kenya", salary: [250000, 350000], skills: ["Python", "Machine Learning", "SQL"], edu: "master" },
  { title: "IT Support Intern", category: "Software Engineering", level: "entry", type: "internship", mode: "onsite", loc: "Nairobi, Kenya", salary: [20000, 30000], skills: ["Customer Service"], edu: "diploma" },
  { title: "PHP Developer", category: "Software Engineering", level: "mid", type: "contract", mode: "remote", loc: "Nairobi, Kenya", salary: [110000, 160000], skills: ["PHP", "Laravel", "WordPress"], edu: "diploma" },
  { title: "Java Backend Engineer", category: "Software Engineering", level: "senior", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [230000, 310000], skills: ["Java", "Spring Boot", "SQL"], edu: "bachelor" },
  { title: "Content Writer", category: "Media & Communications", level: "entry", type: "part_time", mode: "remote", loc: "Nairobi, Kenya", salary: [40000, 65000], skills: ["Content Writing", "SEO"], edu: "diploma" },
  { title: "Operations Manager", category: "Operations & Logistics", level: "senior", type: "full_time", mode: "onsite", loc: "Nairobi, Kenya", salary: [200000, 280000], skills: ["Logistics Planning", "Supply Chain"], edu: "bachelor" },
  { title: "Curriculum Developer", category: "Product & Design", level: "mid", type: "full_time", mode: "hybrid", loc: "Nairobi, Kenya", salary: [100000, 150000], skills: ["Content Writing", "UX Research"], edu: "bachelor" },
  { title: "DevOps Engineer", category: "Software Engineering", level: "senior", type: "full_time", mode: "hybrid", loc: "Nairobi, Kenya", salary: [240000, 330000], skills: ["Docker", "Kubernetes", "AWS"], edu: "bachelor" },
  { title: "UX Researcher", category: "Product & Design", level: "mid", type: "full_time", mode: "remote", loc: "Nairobi, Kenya", salary: [130000, 180000], skills: ["UX Research", "Figma"], edu: "bachelor" },
  { title: "Warehouse Supervisor", category: "Operations & Logistics", level: "mid", type: "full_time", mode: "onsite", loc: "Mombasa, Kenya", salary: [80000, 120000], skills: ["Logistics Planning"], edu: "diploma" }
];

const employerUserIds = (db.prepare(`SELECT owner_user_id FROM companies`).all() as any[]).map(r => r.owner_user_id);
const jobIds: number[] = [];
JOB_TEMPLATES.forEach((t, i) => {
  const companyId = companyIds[i % companyIds.length];
  const createdBy = employerUserIds[i % employerUserIds.length];
  const info = db.prepare(
    `INSERT INTO jobs (company_id, category_id, created_by, title, department, description, responsibilities, requirements,
      experience_level, education_requirement, employment_type, work_mode, location, salary_min, salary_max, currency,
      benefits, openings, application_deadline, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'KES', ?,?,?, 'published')`
  ).run(
    companyId, categoryId(t.category), createdBy, t.title, t.category,
    `We are looking for a talented ${t.title} to join our team in ${t.loc}. You'll work closely with cross-functional teams to deliver high-impact results.`,
    `Own key deliverables end-to-end; collaborate with product, design and engineering; mentor junior team members; report on progress regularly.`,
    `${t.skills.join(", ")} experience required. Strong communication skills and a growth mindset.`,
    t.level, t.edu, t.type, t.mode, t.loc, t.salary[0], t.salary[1],
    "Health insurance, paid time off, learning & development budget.", 1 + (i % 3),
    new Date(Date.now() + 1000 * 60 * 60 * 24 * (14 + (i % 20))).toISOString().slice(0, 10)
  );
  const jobId = Number(info.lastInsertRowid);
  jobIds.push(jobId);
  for (const s of t.skills) db.prepare(`INSERT OR IGNORE INTO job_skills (job_id, skill_id, required) VALUES (?,?,1)`).run(jobId, skillId[s]);
});

const FIRST_NAMES = ["Wanjiru", "Otieno", "Achieng", "Kamau", "Njeri", "Mwangi", "Wafula", "Chebet", "Kiprono", "Auma",
  "Muthoni", "Odhiambo", "Wambui", "Kiptoo", "Nyambura", "Omondi", "Akinyi", "Njoroge", "Cherotich", "Barasa"];
const LAST_NAMES = ["Kariuki", "Ochieng", "Mutua", "Wekesa", "Kimani", "Onyango", "Rotich", "Wachira", "Adhiambo", "Maina"];
const CAND_LOCATIONS = ["Nairobi, Kenya", "Mombasa, Kenya", "Kisumu, Kenya", "Nakuru, Kenya", "Eldoret, Kenya"];
const HEADLINES = ["Full-Stack Software Engineer", "Product Designer", "Digital Marketer", "Financial Analyst",
  "Customer Support Specialist", "HR Professional", "Supply Chain Coordinator", "Data Analyst", "Backend Engineer", "Mobile Developer"];

const candidateProfileIds: number[] = [];
for (let i = 0; i < 22; i++) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[i % LAST_NAMES.length];
  const fullName = `${first} ${last}`;
  const email = `candidate${i + 1}@example.com`;
  const info = db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, role, email_verified, status) VALUES (?,?,?,1,'active')`)
    .run(email, hashPassword(SEED_PASSWORD), "job_seeker");
  const userId = info.lastInsertRowid ? Number(info.lastInsertRowid) : (db.prepare(`SELECT id FROM users WHERE email=?`).get(email) as any).id;
  const years = (i % 8) + 0.5;
  const headline = HEADLINES[i % HEADLINES.length];
  const cpInfo = db.prepare(
    `INSERT INTO candidate_profiles (user_id, full_name, headline, bio, location, phone, years_experience,
      preferred_job_type, preferred_location, preferred_work_mode, expected_salary_min, expected_salary_max,
      availability, career_interests, linkedin_url, github_url, profile_completion)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    userId, fullName, headline, `${headline} with ${years} years of experience across Kenyan and East African companies. Passionate about solving real problems with technology and teamwork.`,
    CAND_LOCATIONS[i % CAND_LOCATIONS.length], `+2547${(10000000 + i * 137).toString().slice(0, 8)}`, years,
    ["full_time", "part_time", "contract", "internship"][i % 4], CAND_LOCATIONS[i % CAND_LOCATIONS.length],
    ["remote", "hybrid", "onsite"][i % 3], 60000 + i * 8000, 90000 + i * 12000,
    ["immediate", "2_weeks", "1_month", "negotiable"][i % 4], `Interested in growing into a senior ${headline} role.`,
    `https://linkedin.com/in/${first.toLowerCase()}${last.toLowerCase()}`, i % 2 === 0 ? `https://github.com/${first.toLowerCase()}${i}` : null, 0
  );
  const candidateId = Number(cpInfo.lastInsertRowid);
  candidateProfileIds.push(candidateId);
  db.prepare(`INSERT INTO education (candidate_id, institution, degree, field, start_year, end_year) VALUES (?,?,?,?,?,?)`)
    .run(candidateId, ["University of Nairobi", "Jomo Kenyatta University", "Strathmore University", "Kenyatta University", "Moi University"][i % 5],
      ["bachelor", "diploma", "bachelor", "master", "certificate"][i % 5], headline.split(" ")[0], 2012 + (i % 6), 2016 + (i % 6));
  db.prepare(`INSERT INTO experience (candidate_id, company, title, start_date, end_date, is_current, description) VALUES (?,?,?,?,?,?,?)`)
    .run(candidateId, COMPANIES[(i + 3) % COMPANIES.length].name, headline, "2021-01-01", null, 1, `Led key initiatives as a ${headline}.`);
  const relevantSkills = JOB_TEMPLATES[i % JOB_TEMPLATES.length].skills;
  for (const s of relevantSkills) db.prepare(`INSERT OR IGNORE INTO candidate_skills (candidate_id, skill_id, level) VALUES (?,?, 'advanced')`).run(candidateId, skillId[s]);
}

// Applications, status history, a few interviews, and notifications so the
// platform looks genuinely populated on first launch.
const STATUSES = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected"] as const;
let appCount = 0;
candidateProfileIds.forEach((candidateId, ci) => {
  const jobsToApply = [jobIds[ci % jobIds.length], jobIds[(ci + 5) % jobIds.length]];
  jobsToApply.forEach((jobId, k) => {
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
    const candidate = db.prepare(`SELECT * FROM candidate_profiles WHERE id = ?`).get(candidateId) as any;
    const candSkills = (db.prepare(`SELECT sk.name FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id WHERE cs.candidate_id = ?`).all(candidateId) as any[]).map(r => r.name);
    const jobSkills = (db.prepare(`SELECT sk.name FROM job_skills js JOIN skills sk ON sk.id = js.skill_id WHERE js.job_id = ?`).all(jobId) as any[]).map(r => r.name);
    const match = calculateMatch(
      { skills: candSkills, yearsExperience: candidate.years_experience, preferredLocation: candidate.preferred_location, preferredJobType: candidate.preferred_job_type, expectedSalaryMin: candidate.expected_salary_min, expectedSalaryMax: candidate.expected_salary_max, highestEducationLevel: "bachelor" },
      { requiredSkills: jobSkills, experienceLevel: job.experience_level, location: job.location, workMode: job.work_mode, employmentType: job.employment_type, salaryMin: job.salary_min, salaryMax: job.salary_max, educationRequirement: job.education_requirement }
    );
    const status = STATUSES[(ci + k) % STATUSES.length];
    const existing = db.prepare(`SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?`).get(jobId, candidateId);
    if (existing) return;
    const info = db.prepare(`INSERT INTO applications (job_id, candidate_id, status, match_score) VALUES (?,?,?,?)`).run(jobId, candidateId, status, match.overall);
    const appId = Number(info.lastInsertRowid);
    db.prepare(`INSERT INTO application_status_history (application_id, status) VALUES (?, 'applied')`).run(appId);
    if (status !== "applied") db.prepare(`INSERT INTO application_status_history (application_id, status) VALUES (?, ?)`).run(appId, status);
    appCount++;
    if (status === "interview" || status === "offer" || status === "hired") {
      db.prepare(`INSERT INTO interviews (application_id, scheduled_by, scheduled_at, type, location_or_link, status) VALUES (?,?,?,?,?,?)`)
        .run(appId, job.created_by, new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), ["video", "physical", "technical"][ci % 3], "https://meet.hireconnect.example/room", status === "hired" ? "completed" : "scheduled");
    }
    db.prepare(`INSERT INTO notifications (user_id, type, title, body) VALUES (?,?,?,?)`)
      .run(candidate.user_id, "status_changed", `Application update: ${job.title}`, `Your application is now: ${status.replace("_", " ")}.`);
  });
});

// A demo admin account.
const adminEmail = "admin@hireconnect.co.ke";
if (!db.prepare(`SELECT id FROM users WHERE email = ?`).get(adminEmail)) {
  db.prepare(`INSERT INTO users (email, password_hash, role, email_verified, status) VALUES (?,?,?,1,'active')`)
    .run(adminEmail, hashPassword(SEED_ADMIN_PASSWORD), "admin");
}

console.log(`Seed complete: ${COMPANIES.length} companies, ${JOB_TEMPLATES.length} jobs, ${candidateProfileIds.length} candidates, ${appCount} applications.`);
console.log(`Demo logins (passwords: ${SEED_PASSWORD}, admin: ${SEED_ADMIN_PASSWORD}):`);
console.log("  Admin:     admin@hireconnect.co.ke");
console.log("  Employer:  employer1@twigadigitalsolutions.co.ke");
console.log("  Candidate: candidate1@example.com");
