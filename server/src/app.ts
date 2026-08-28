import { DatabaseSync } from "node:sqlite";
import { Router, sendJson } from "./router.ts";
import type { Ctx } from "./router.ts";
import { hashPassword, verifyPassword, generateToken, SESSION_TTL_MS } from "./auth.ts";
import { calculateMatch } from "./matching.ts";
import type { MatchCandidate, MatchJob } from "./matching.ts";
import { isEmail, isNonEmptyString, isStrongPassword, isOneOf, toInt, ValidationError } from "./validation.ts";
import { isRateLimited } from "./rateLimit.ts";
import { saveBase64File, readUploadedFile, UploadError } from "./uploads.ts";

const ROLES = ["job_seeker", "employer", "admin"] as const;
// Per Phase 21 (Kenyan-first job types): full-time/part-time/contract were
// the original set; these additions are common Kenyan employment
// categories the frontend now needs to be able to post/search.
const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship", "attachment", "graduate_trainee", "freelance", "temporary"] as const;
const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "executive"] as const;
const APPLICATION_STATUSES = ["applied", "screening", "shortlisted", "interview", "offer", "hired", "rejected", "withdrawn"] as const;

export function buildApp(db: DatabaseSync) {
  const router = new Router();

  // ---------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------
  function currentUser(ctx: Ctx): Row | null {
    const header = ctx.req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    const session = db.prepare(
      `SELECT s.*, u.id as uid, u.email, u.role, u.status FROM sessions s
       JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    ).get(token) as Row | undefined;
    if (!session) return null;
    if (new Date(session.expires_at as string).getTime() < Date.now()) return null;
    if (session.status !== "active") return null;
    return session;
  }

  function requireAuth(ctx: Ctx): Row {
    const user = currentUser(ctx);
    if (!user) { sendJson(ctx.res, 401, { error: "Authentication required" }); throw new Halt(); }
    ctx.userId = user.uid as number;
    ctx.role = user.role as string;
    return user;
  }

  function requireRole(ctx: Ctx, roles: string[]): Row {
    const user = requireAuth(ctx);
    if (!roles.includes(user.role as string)) {
      sendJson(ctx.res, 403, { error: "You do not have permission to perform this action" });
      throw new Halt();
    }
    return user;
  }

  function limited(ctx: Ctx, name: string, limit: number, windowMs: number) {
    const ip = ctx.req.socket.remoteAddress ?? "unknown";
    if (isRateLimited(`${name}:${ip}`, limit, windowMs)) {
      sendJson(ctx.res, 429, { error: "Too many requests, please slow down." });
      throw new Halt();
    }
  }

  function notify(userId: number, type: string, title: string, body?: string, data?: any) {
    db.prepare(`INSERT INTO notifications (user_id, type, title, body, data_json) VALUES (?,?,?,?,?)`)
      .run(userId, type, title, body ?? null, data ? JSON.stringify(data) : null);
  }

  function logAdmin(adminId: number, action: string, targetType?: string, targetId?: number, details?: string) {
    db.prepare(`INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) VALUES (?,?,?,?,?)`)
      .run(adminId, action, targetType ?? null, targetId ?? null, details ?? null);
  }

  function trackEvent(eventType: string, userId: number | undefined, entityType?: string, entityId?: number, metadata?: Record<string, unknown>) {
    db.prepare(`INSERT INTO analytics_events (event_type, user_id, entity_type, entity_id, metadata) VALUES (?,?,?,?,?)`)
      .run(eventType, userId ?? null, entityType ?? null, entityId ?? null, metadata ? JSON.stringify(metadata) : null);
  }

  function candidateProfileFor(userId: number): Row | undefined {
    return db.prepare(`SELECT * FROM candidate_profiles WHERE user_id = ?`).get(userId) as Row | undefined;
  }

  function computeProfileCompletion(p: Row, skillCount: number, eduCount: number, expCount: number): number {
    const checks = [
      !!p.full_name, !!p.headline, !!p.bio, !!p.location, !!p.phone,
      skillCount > 0, (p.years_experience ?? 0) > 0, eduCount > 0, expCount > 0,
      !!p.cv_path, !!p.linkedin_url, !!p.preferred_job_type, p.expected_salary_min != null
    ];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return score;
  }

  // ---------------------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------------------
  router.post("/api/auth/register", (ctx) => {
    limited(ctx, "register", 10, 60_000);
    const { email, password, role, fullName, companyName } = ctx.body ?? {};
    if (!isEmail(email)) throw new ValidationError("A valid email is required.");
    if (!isStrongPassword(password)) throw new ValidationError("Password must be at least 8 characters.");
    if (!isOneOf(role, ROLES.filter(r => r !== "admin"))) throw new ValidationError("Role must be job_seeker or employer.");
    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) throw new ValidationError("An account with this email already exists.");

    const verificationToken = generateToken();
    const info = db.prepare(
      `INSERT INTO users (email, password_hash, role, verification_token) VALUES (?,?,?,?)`
    ).run(email, hashPassword(password), role, verificationToken);
    const userId = Number(info.lastInsertRowid);

    if (role === "job_seeker") {
      db.prepare(`INSERT INTO candidate_profiles (user_id, full_name) VALUES (?, ?)`)
        .run(userId, isNonEmptyString(fullName) ? fullName : "New Candidate");
    } else if (role === "employer") {
      db.prepare(`INSERT INTO employer_profiles (user_id) VALUES (?)`).run(userId);
      if (isNonEmptyString(companyName)) {
        db.prepare(`INSERT INTO companies (owner_user_id, name) VALUES (?, ?)`).run(userId, companyName);
      }
    }
    notify(userId, "welcome", "Welcome to HireConnect!", "Verify your email to unlock all features.");
    // In production this token is emailed via the modular email service —
    // see docs/EMAIL_TEMPLATES.md. It's only echoed in the response outside
    // production, so local/dev testing doesn't need a real mail provider.
    const isProd = process.env.NODE_ENV === "production";
    sendJson(ctx.res, 201, { message: "Registered successfully.", ...(isProd ? {} : { devVerificationToken: verificationToken }) });
  });

  router.post("/api/auth/verify-email", (ctx) => {
    const { token } = ctx.body ?? {};
    const user = db.prepare(`SELECT id FROM users WHERE verification_token = ?`).get(token) as Row | undefined;
    if (!user) throw new ValidationError("Invalid or expired verification token.");
    db.prepare(`UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?`).run(user.id);
    sendJson(ctx.res, 200, { message: "Email verified." });
  });

  router.post("/api/auth/login", (ctx) => {
    limited(ctx, "login", 20, 60_000);
    const { email, password } = ctx.body ?? {};
    const user = db.prepare(`SELECT * FROM users WHERE email = ? AND deleted_at IS NULL`).get(email) as Row | undefined;
    if (!user || !verifyPassword(password ?? "", user.password_hash as string)) {
      throw new ValidationError("Invalid email or password.");
    }
    if (user.status === "suspended") { sendJson(ctx.res, 403, { error: "This account has been suspended." }); return; }
    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?,?,?)`).run(user.id, token, expiresAt);
    sendJson(ctx.res, 200, { token, user: { id: user.id, email: user.email, role: user.role, emailVerified: !!user.email_verified } });
  });

  router.post("/api/auth/logout", (ctx) => {
    const header = ctx.req.headers["authorization"];
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
    sendJson(ctx.res, 200, { message: "Logged out." });
  });

  router.post("/api/auth/forgot-password", (ctx) => {
    limited(ctx, "forgot-password", 10, 60_000);
    const { email } = ctx.body ?? {};
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as Row | undefined;
    // Always respond the same way whether or not the account exists, to
    // avoid leaking which emails are registered.
    if (user) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();
      db.prepare(`INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)`).run(user.id, token, expiresAt);
      const isProd = process.env.NODE_ENV === "production";
      sendJson(ctx.res, 200, { message: "If that account exists, a reset link has been sent.", ...(isProd ? {} : { devResetToken: token }) });
      return;
    }
    sendJson(ctx.res, 200, { message: "If that account exists, a reset link has been sent." });
  });

  router.post("/api/auth/reset-password", (ctx) => {
    const { token, password } = ctx.body ?? {};
    if (!isStrongPassword(password)) throw new ValidationError("Password must be at least 8 characters.");
    const reset = db.prepare(`SELECT * FROM password_resets WHERE token = ?`).get(token) as Row | undefined;
    if (!reset || reset.used_at || new Date(reset.expires_at as string).getTime() < Date.now()) {
      throw new ValidationError("Invalid or expired reset token.");
    }
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hashPassword(password), reset.user_id);
    db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`).run(reset.id);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(reset.user_id);
    sendJson(ctx.res, 200, { message: "Password reset. Please log in again." });
  });

  router.get("/api/auth/me", (ctx) => {
    const user = requireAuth(ctx);
    sendJson(ctx.res, 200, { id: user.uid, email: user.email, role: user.role });
  });

  // ---------------------------------------------------------------------
  // CANDIDATE PROFILE
  // ---------------------------------------------------------------------
  function fullCandidateProfile(profile: Row) {
    const skills = db.prepare(
      `SELECT sk.id, sk.name, cs.level FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id WHERE cs.candidate_id = ?`
    ).all(profile.id);
    const education = db.prepare(`SELECT * FROM education WHERE candidate_id = ?`).all(profile.id);
    const experience = db.prepare(`SELECT * FROM experience WHERE candidate_id = ?`).all(profile.id);
    const certifications = db.prepare(`SELECT * FROM certifications WHERE candidate_id = ?`).all(profile.id);
    const languages = db.prepare(`SELECT * FROM candidate_languages WHERE candidate_id = ?`).all(profile.id);
    const completion = computeProfileCompletion(profile, skills.length, education.length, experience.length);
    if (completion !== profile.profile_completion) {
      db.prepare(`UPDATE candidate_profiles SET profile_completion = ? WHERE id = ?`).run(completion, profile.id);
    }
    const missing: string[] = [];
    if (!profile.headline) missing.push("Add a professional headline");
    if (!profile.bio) missing.push("Write a short bio");
    if (skills.length === 0) missing.push("Add your skills");
    if (education.length === 0) missing.push("Add your education");
    if (experience.length === 0) missing.push("Add your work experience");
    if (!profile.cv_path) missing.push("Upload your CV");
    if (!profile.expected_salary_min) missing.push("Set your expected salary");
    return { ...profile, profile_completion: completion, skills, education, experience, certifications, languages, missing };
  }

  router.get("/api/candidates/me", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!);
    if (!profile) { sendJson(ctx.res, 404, { error: "Profile not found" }); return; }
    sendJson(ctx.res, 200, fullCandidateProfile(profile));
  });

  router.put("/api/candidates/me", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const b = ctx.body ?? {};
    const fields: [string, any][] = [
      ["full_name", b.fullName], ["photo_url", b.photoUrl], ["headline", b.headline], ["bio", b.bio],
      ["location", b.location], ["phone", b.phone], ["years_experience", toInt(b.yearsExperience, profile.years_experience as number)],
      ["preferred_job_type", b.preferredJobType], ["preferred_location", b.preferredLocation],
      ["preferred_work_mode", b.preferredWorkMode], ["expected_salary_min", toInt(b.expectedSalaryMin, profile.expected_salary_min as number | null)],
      ["expected_salary_max", toInt(b.expectedSalaryMax, profile.expected_salary_max as number | null)],
      ["availability", b.availability], ["career_interests", b.careerInterests],
      ["linkedin_url", b.linkedinUrl], ["github_url", b.githubUrl], ["portfolio_url", b.portfolioUrl]
    ];
    for (const [col, val] of fields) {
      if (val !== undefined) db.prepare(`UPDATE candidate_profiles SET ${col} = ? WHERE id = ?`).run(val ?? null, profile.id);
    }
    db.prepare(`UPDATE candidate_profiles SET updated_at = datetime('now') WHERE id = ?`).run(profile.id);
    sendJson(ctx.res, 200, fullCandidateProfile(candidateProfileFor(ctx.userId!)!));
  });

  router.post("/api/candidates/me/skills", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const { name, level } = ctx.body ?? {};
    if (!isNonEmptyString(name, 60)) throw new ValidationError("Skill name is required.");
    let skill = db.prepare(`SELECT id FROM skills WHERE name = ?`).get(name) as Row | undefined;
    if (!skill) {
      const info = db.prepare(`INSERT INTO skills (name) VALUES (?)`).run(name);
      skill = { id: info.lastInsertRowid };
    }
    db.prepare(`INSERT OR REPLACE INTO candidate_skills (candidate_id, skill_id, level) VALUES (?,?,?)`)
      .run(profile.id, skill.id, level ?? "intermediate");
    sendJson(ctx.res, 201, fullCandidateProfile(candidateProfileFor(ctx.userId!)!));
  });

  router.post("/api/candidates/me/education", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const { institution, degree, field, startYear, endYear } = ctx.body ?? {};
    if (!isNonEmptyString(institution) || !isNonEmptyString(degree)) throw new ValidationError("Institution and degree are required.");
    db.prepare(`INSERT INTO education (candidate_id, institution, degree, field, start_year, end_year) VALUES (?,?,?,?,?,?)`)
      .run(profile.id, institution, degree, field ?? null, toInt(startYear), toInt(endYear));
    sendJson(ctx.res, 201, fullCandidateProfile(candidateProfileFor(ctx.userId!)!));
  });

  router.post("/api/candidates/me/experience", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const { company, title, startDate, endDate, isCurrent, description } = ctx.body ?? {};
    if (!isNonEmptyString(company) || !isNonEmptyString(title)) throw new ValidationError("Company and title are required.");
    db.prepare(`INSERT INTO experience (candidate_id, company, title, start_date, end_date, is_current, description) VALUES (?,?,?,?,?,?,?)`)
      .run(profile.id, company, title, startDate ?? null, endDate ?? null, isCurrent ? 1 : 0, description ?? null);
    sendJson(ctx.res, 201, fullCandidateProfile(candidateProfileFor(ctx.userId!)!));
  });

  router.post("/api/candidates/me/cv", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const { fileName, base64 } = ctx.body ?? {};
    if (!isNonEmptyString(fileName) || !isNonEmptyString(base64, 20_000_000)) throw new ValidationError("A file is required.");
    const stored = saveBase64File(fileName, base64);
    db.prepare(`UPDATE candidate_profiles SET cv_path = ? WHERE id = ?`).run(stored, profile.id);
    sendJson(ctx.res, 200, { message: "CV uploaded.", cvId: stored });
  });

  router.get("/api/candidates/:id", (ctx) => {
    const requester = requireRole(ctx, ["employer", "admin"]);
    const profile = db.prepare(`SELECT * FROM candidate_profiles WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!profile) { sendJson(ctx.res, 404, { error: "Candidate not found" }); return; }
    trackEvent("profile_view", requester.uid as number, "candidate", profile.id as number);
    sendJson(ctx.res, 200, fullCandidateProfile(profile));
  });

  router.get("/api/candidates/:id/cv", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const profile = db.prepare(`SELECT * FROM candidate_profiles WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!profile?.cv_path) { sendJson(ctx.res, 404, { error: "No CV on file" }); return; }
    try {
      const buffer = readUploadedFile(profile.cv_path as string);
      ctx.res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${profile.cv_path}"` });
      ctx.res.end(buffer);
    } catch {
      sendJson(ctx.res, 404, { error: "File not found" });
    }
  });

  // ---------------------------------------------------------------------
  // COMPANIES
  // ---------------------------------------------------------------------
  router.get("/api/companies", (ctx) => {
    const page = toInt(ctx.query.get("page"), 1)!;
    const pageSize = 20;
    const rows = db.prepare(
      `SELECT * FROM companies WHERE status = 'approved' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(pageSize, (page - 1) * pageSize);
    sendJson(ctx.res, 200, { companies: rows, page, pageSize });
  });

  router.get("/api/companies/:id", (ctx) => {
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!company) { sendJson(ctx.res, 404, { error: "Company not found" }); return; }
    const openJobs = db.prepare(`SELECT * FROM jobs WHERE company_id = ? AND status = 'published' ORDER BY created_at DESC`).all(company.id);
    const viewer = currentUser(ctx);
    trackEvent("company_view", viewer?.uid as number | undefined, "company", company.id as number);
    sendJson(ctx.res, 200, { ...company, openJobs });
  });

  router.post("/api/companies", (ctx) => {
    requireRole(ctx, ["employer"]);
    const b = ctx.body ?? {};
    if (!isNonEmptyString(b.name)) throw new ValidationError("Company name is required.");
    const info = db.prepare(
      `INSERT INTO companies (owner_user_id, name, description, website, location, size, founded_year)
       VALUES (?,?,?,?,?,?,?)`
    ).run(ctx.userId, b.name, b.description ?? null, b.website ?? null, b.location ?? null, b.size ?? null, toInt(b.foundedYear));
    db.prepare(`UPDATE employer_profiles SET company_id = ? WHERE user_id = ?`).run(info.lastInsertRowid, ctx.userId);
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM companies WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.put("/api/companies/:id", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!company) { sendJson(ctx.res, 404, { error: "Company not found" }); return; }
    if (ctx.role !== "admin" && company.owner_user_id !== ctx.userId) { sendJson(ctx.res, 403, { error: "Not your company" }); return; }
    const b = ctx.body ?? {};
    const fields: [string, any][] = [
      ["name", b.name], ["logo_url", b.logoUrl], ["description", b.description], ["website", b.website],
      ["location", b.location], ["size", b.size], ["founded_year", toInt(b.foundedYear)], ["culture", b.culture],
      ["benefits", b.benefits], ["social_links", b.socialLinks ? JSON.stringify(b.socialLinks) : undefined]
    ];
    for (const [col, val] of fields) if (val !== undefined) db.prepare(`UPDATE companies SET ${col} = ? WHERE id = ?`).run(val, company.id);
    sendJson(ctx.res, 200, db.prepare(`SELECT * FROM companies WHERE id = ?`).get(company.id));
  });

  router.post("/api/companies/:id/follow", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    db.prepare(`INSERT OR IGNORE INTO followed_companies (candidate_id, company_id) VALUES (?,?)`).run(profile.id, ctx.params.id);
    sendJson(ctx.res, 200, { message: "Following company." });
  });

  // ---------------------------------------------------------------------
  // JOBS
  // ---------------------------------------------------------------------
  function jobToMatchJob(job: Row): MatchJob {
    const requiredSkills = (db.prepare(`SELECT sk.name FROM job_skills js JOIN skills sk ON sk.id = js.skill_id WHERE js.job_id = ? AND js.required = 1`).all(job.id) as Row[]).map(r => r.name as string);
    return {
      requiredSkills,
      experienceLevel: (job.experience_level as MatchJob["experienceLevel"]) ?? "mid",
      location: job.location as string, workMode: job.work_mode as MatchJob["workMode"],
      employmentType: job.employment_type as string, salaryMin: job.salary_min as number, salaryMax: job.salary_max as number,
      educationRequirement: job.education_requirement as any
    };
  }

  function candidateToMatchCandidate(profile: Row): MatchCandidate {
    const skills = (db.prepare(`SELECT sk.name FROM candidate_skills cs JOIN skills sk ON sk.id = cs.skill_id WHERE cs.candidate_id = ?`).all(profile.id) as Row[]).map(r => r.name as string);
    const highestEdu = db.prepare(`SELECT degree FROM education WHERE candidate_id = ? ORDER BY end_year DESC LIMIT 1`).get(profile.id) as Row | undefined;
    return {
      skills, yearsExperience: (profile.years_experience as number) ?? 0,
      preferredLocation: profile.preferred_location as string, preferredWorkMode: profile.preferred_work_mode as string,
      preferredJobType: profile.preferred_job_type as string, expectedSalaryMin: profile.expected_salary_min as number,
      expectedSalaryMax: profile.expected_salary_max as number, highestEducationLevel: (highestEdu?.degree as any) ?? "none"
    };
  }

  router.get("/api/jobs", (ctx) => {
    const q = ctx.query;
    const clauses = ["j.status = 'published'", "j.deleted_at IS NULL"];
    const params: any[] = [];
    if (q.get("q")) { clauses.push("(j.title LIKE ? OR j.description LIKE ?)"); params.push(`%${q.get("q")}%`, `%${q.get("q")}%`); }
    if (q.get("location")) { clauses.push("j.location LIKE ?"); params.push(`%${q.get("location")}%`); }
    if (q.get("employmentType")) { clauses.push("j.employment_type = ?"); params.push(q.get("employmentType")); }
    if (q.get("workMode")) { clauses.push("j.work_mode = ?"); params.push(q.get("workMode")); }
    if (q.get("experienceLevel")) { clauses.push("j.experience_level = ?"); params.push(q.get("experienceLevel")); }
    if (q.get("minSalary")) { clauses.push("j.salary_max >= ?"); params.push(toInt(q.get("minSalary"))); }
    if (q.get("companyId")) { clauses.push("j.company_id = ?"); params.push(q.get("companyId")); }
    const sort = q.get("sort") === "salary" ? "j.salary_max DESC" : q.get("sort") === "oldest" ? "j.created_at ASC" : "j.created_at DESC";
    const page = toInt(q.get("page"), 1)!;
    const pageSize = 20;
    const rows = db.prepare(
      `SELECT j.*, c.name as company_name, c.logo_url as company_logo FROM jobs j
       JOIN companies c ON c.id = j.company_id WHERE ${clauses.join(" AND ")} ORDER BY ${sort} LIMIT ? OFFSET ?`
    ).all(...params, pageSize, (page - 1) * pageSize) as Row[];
    const total = (db.prepare(`SELECT COUNT(*) as n FROM jobs j WHERE ${clauses.join(" AND ")}`).get(...params) as Row).n;

    const user = currentUser(ctx);
    const profile = user?.role === "job_seeker" ? candidateProfileFor(user.uid as number) : undefined;
    const jobs = rows.map((job) => {
      const skills = (db.prepare(`SELECT sk.name, js.required FROM job_skills js JOIN skills sk ON sk.id = js.skill_id WHERE js.job_id = ?`).all(job.id) as Row[]);
      let matchScore: number | undefined;
      if (profile) matchScore = calculateMatch(candidateToMatchCandidate(profile), jobToMatchJob(job)).overall;
      return { ...job, skills, matchScore };
    });
    if (q.get("q") || q.get("location") || q.get("employmentType") || q.get("workMode") || q.get("experienceLevel")) {
      trackEvent("search", user?.uid as number | undefined, "job_search", undefined, {
        q: q.get("q"), location: q.get("location"), employmentType: q.get("employmentType"),
        workMode: q.get("workMode"), experienceLevel: q.get("experienceLevel"), resultCount: total
      });
    }
    sendJson(ctx.res, 200, { jobs, page, pageSize, total });
  });

  router.get("/api/jobs/recommended", (ctx) => {    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const rows = db.prepare(`SELECT j.*, c.name as company_name, c.logo_url as company_logo FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'published' AND j.deleted_at IS NULL`).all() as Row[];
    const withScores = rows.map(job => ({ ...job, matchScore: calculateMatch(candidateToMatchCandidate(profile), jobToMatchJob(job)).overall }));
    withScores.sort((a, b) => b.matchScore - a.matchScore);
    sendJson(ctx.res, 200, { jobs: withScores.slice(0, 20) });
  });

  router.get("/api/jobs/:id", (ctx) => {
    const job = db.prepare(`SELECT j.*, c.name as company_name, c.logo_url as company_logo FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    db.prepare(`UPDATE jobs SET views = views + 1 WHERE id = ?`).run(job.id);
    const viewer = currentUser(ctx);
    trackEvent("job_view", viewer?.uid as number | undefined, "job", job.id as number);
    const skills = db.prepare(`SELECT sk.name, js.required FROM job_skills js JOIN skills sk ON sk.id = js.skill_id WHERE js.job_id = ?`).all(job.id);
    sendJson(ctx.res, 200, { ...job, skills });
  });

  router.get("/api/jobs/:id/match", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    const profile = candidateProfileFor(ctx.userId!)!;
    sendJson(ctx.res, 200, calculateMatch(candidateToMatchCandidate(profile), jobToMatchJob(job)));
  });

  function ownsJobsCompany(ctx: Ctx, companyId: number): boolean {
    if (ctx.role === "admin") return true;
    const company = db.prepare(`SELECT owner_user_id FROM companies WHERE id = ?`).get(companyId) as Row | undefined;
    return !!company && company.owner_user_id === ctx.userId;
  }

  router.post("/api/jobs", (ctx) => {
    requireRole(ctx, ["employer"]);
    const b = ctx.body ?? {};
    const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
    if (!employer?.company_id) throw new ValidationError("Create a company profile before posting jobs.");
    if (!isNonEmptyString(b.title) || !isNonEmptyString(b.description)) throw new ValidationError("Title and description are required.");
    if (!isOneOf(b.employmentType, EMPLOYMENT_TYPES)) throw new ValidationError("Invalid employment type.");
    if (!isOneOf(b.workMode, WORK_MODES)) throw new ValidationError("Invalid work mode.");
    const info = db.prepare(
      `INSERT INTO jobs (company_id, category_id, created_by, title, department, description, responsibilities, requirements,
        experience_level, education_requirement, employment_type, work_mode, location, salary_min, salary_max, benefits,
        openings, application_deadline, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      employer.company_id, toInt(b.categoryId), ctx.userId, b.title, b.department ?? null, b.description,
      b.responsibilities ?? null, b.requirements ?? null, isOneOf(b.experienceLevel, EXPERIENCE_LEVELS) ? b.experienceLevel : "mid",
      b.educationRequirement ?? null, b.employmentType, b.workMode, b.location ?? null, toInt(b.salaryMin), toInt(b.salaryMax),
      b.benefits ?? null, toInt(b.openings, 1), b.applicationDeadline ?? null, b.status === "published" ? "published" : "draft"
    );
    const jobId = Number(info.lastInsertRowid);
    for (const name of (b.skills ?? []) as string[]) {
      let skill = db.prepare(`SELECT id FROM skills WHERE name = ?`).get(name) as Row | undefined;
      if (!skill) { const s = db.prepare(`INSERT INTO skills (name) VALUES (?)`).run(name); skill = { id: s.lastInsertRowid }; }
      db.prepare(`INSERT OR IGNORE INTO job_skills (job_id, skill_id, required) VALUES (?,?,1)`).run(jobId, skill.id);
    }
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId));
  });

  function updateJobStatus(ctx: Ctx, status: string) {
    requireRole(ctx, ["employer", "admin"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    if (!ownsJobsCompany(ctx, job.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    db.prepare(`UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, job.id);
    sendJson(ctx.res, 200, db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(job.id));
  }
  router.put("/api/jobs/:id", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    if (!ownsJobsCompany(ctx, job.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    const b = ctx.body ?? {};
    const fields: [string, any][] = [
      ["title", b.title], ["department", b.department], ["description", b.description], ["responsibilities", b.responsibilities],
      ["requirements", b.requirements], ["experience_level", b.experienceLevel], ["education_requirement", b.educationRequirement],
      ["employment_type", b.employmentType], ["work_mode", b.workMode], ["location", b.location],
      ["salary_min", toInt(b.salaryMin)], ["salary_max", toInt(b.salaryMax)], ["benefits", b.benefits],
      ["openings", toInt(b.openings)], ["application_deadline", b.applicationDeadline]
    ];
    for (const [col, val] of fields) if (val !== undefined) db.prepare(`UPDATE jobs SET ${col} = ? WHERE id = ?`).run(val, job.id);
    db.prepare(`UPDATE jobs SET updated_at = datetime('now') WHERE id = ?`).run(job.id);
    sendJson(ctx.res, 200, db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(job.id));
  });
  router.post("/api/jobs/:id/publish", (ctx) => updateJobStatus(ctx, "published"));
  router.post("/api/jobs/:id/pause", (ctx) => updateJobStatus(ctx, "paused"));
  router.post("/api/jobs/:id/close", (ctx) => updateJobStatus(ctx, "closed"));
  router.delete("/api/jobs/:id", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    if (!ownsJobsCompany(ctx, job.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    db.prepare(`UPDATE jobs SET deleted_at = datetime('now') WHERE id = ?`).run(job.id);
    sendJson(ctx.res, 200, { message: "Job deleted." });
  });
  router.post("/api/jobs/:id/duplicate", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found" }); return; }
    if (!ownsJobsCompany(ctx, job.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    const info = db.prepare(
      `INSERT INTO jobs (company_id, category_id, created_by, title, department, description, responsibilities, requirements,
        experience_level, education_requirement, employment_type, work_mode, location, salary_min, salary_max, benefits, openings, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')`
    ).run(job.company_id, job.category_id, ctx.userId, `${job.title} (Copy)`, job.department, job.description, job.responsibilities,
      job.requirements, job.experience_level, job.education_requirement, job.employment_type, job.work_mode, job.location,
      job.salary_min, job.salary_max, job.benefits, job.openings);
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.get("/api/employers/me/jobs", (ctx) => {
    requireRole(ctx, ["employer"]);
    const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
    const jobs = employer?.company_id
      ? db.prepare(`SELECT * FROM jobs WHERE company_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`).all(employer.company_id)
      : [];
    sendJson(ctx.res, 200, { jobs });
  });

  // Lets the employer's "company profile" form know whether to create or
  // edit — fixes the audited gap where the form always assumed create-only.
  router.get("/api/employers/me/company", (ctx) => {
    requireRole(ctx, ["employer"]);
    const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
    if (!employer?.company_id) { sendJson(ctx.res, 200, { company: null }); return; }
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(employer.company_id);
    sendJson(ctx.res, 200, { company: company ?? null });
  });

  router.get("/api/employers/me/dashboard", (ctx) => {
    requireRole(ctx, ["employer"]);
    const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
    const companyId = employer?.company_id;
    const stat = (sql: string) => companyId ? (db.prepare(sql).get(companyId) as Row).n as number : 0;
    sendJson(ctx.res, 200, {
      activeJobs: stat(`SELECT COUNT(*) as n FROM jobs WHERE company_id = ? AND status = 'published' AND deleted_at IS NULL`),
      totalApplications: stat(`SELECT COUNT(*) as n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?`),
      shortlisted: stat(`SELECT COUNT(*) as n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.status = 'shortlisted'`),
      interviews: stat(`SELECT COUNT(*) as n FROM interviews iv JOIN applications a ON a.id = iv.application_id JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?`),
      hires: stat(`SELECT COUNT(*) as n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.status = 'hired'`),
      qualifiedApplicants: stat(`SELECT COUNT(*) as n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.match_score >= 60`),
      offers: stat(`SELECT COUNT(*) as n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.status = 'offer'`),
      profileViews: stat(`SELECT COALESCE(SUM(views),0) as n FROM jobs WHERE company_id = ?`)
    });
  });

  // ---------------------------------------------------------------------
  // APPLICATIONS / ATS
  // ---------------------------------------------------------------------
  router.post("/api/jobs/:id/apply", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const job = db.prepare(`SELECT * FROM jobs WHERE id = ? AND status = 'published'`).get(ctx.params.id) as Row | undefined;
    if (!job) { sendJson(ctx.res, 404, { error: "Job not found or not accepting applications" }); return; }
    const profile = candidateProfileFor(ctx.userId!)!;
    const existing = db.prepare(`SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?`).get(job.id, profile.id);
    if (existing) throw new ValidationError("You've already applied to this job.");
    const match = calculateMatch(candidateToMatchCandidate(profile), jobToMatchJob(job));
    const info = db.prepare(
      `INSERT INTO applications (job_id, candidate_id, match_score, cover_note, cv_path) VALUES (?,?,?,?,?)`
    ).run(job.id, profile.id, match.overall, (ctx.body ?? {}).coverNote ?? null, profile.cv_path as string ?? null);
    db.prepare(`INSERT INTO application_status_history (application_id, status, changed_by) VALUES (?,'applied',?)`).run(info.lastInsertRowid, ctx.userId);
    const employer = db.prepare(`SELECT owner_user_id FROM companies WHERE id = ?`).get(job.company_id) as Row;
    notify(employer.owner_user_id as number, "new_applicant", "New applicant", `A candidate applied for ${job.title}.`, { jobId: job.id });
    notify(ctx.userId!, "application_submitted", "Application submitted", `Your application for ${job.title} was submitted.`, { jobId: job.id });
    trackEvent("job_apply", ctx.userId, "job", job.id as number, { matchScore: match.overall });
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM applications WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.get("/api/applications", (ctx) => {
    const user = requireAuth(ctx);
    if (user.role === "job_seeker") {
      const profile = candidateProfileFor(ctx.userId!)!;
      const rows = db.prepare(
        `SELECT a.*, j.title as job_title, c.name as company_name FROM applications a
         JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
         WHERE a.candidate_id = ? ORDER BY a.applied_at DESC`
      ).all(profile.id);
      sendJson(ctx.res, 200, { applications: rows });
    } else if (user.role === "employer") {
      const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
      const status = ctx.query.get("status");
      const clauses = ["j.company_id = ?"]; const params: any[] = [employer?.company_id ?? -1];
      if (status) { clauses.push("a.status = ?"); params.push(status); }
      const rows = db.prepare(
        `SELECT a.*, j.title as job_title, cp.full_name as candidate_name, cp.photo_url as candidate_photo, cp.id as candidate_profile_id
         FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidate_profiles cp ON cp.id = a.candidate_id
         WHERE ${clauses.join(" AND ")} ORDER BY a.applied_at DESC`
      ).all(...params);
      sendJson(ctx.res, 200, { applications: rows });
    } else {
      const rows = db.prepare(`SELECT a.*, j.title as job_title FROM applications a JOIN jobs j ON j.id = a.job_id ORDER BY a.applied_at DESC LIMIT 200`).all();
      sendJson(ctx.res, 200, { applications: rows });
    }
  });

  router.get("/api/applications/:id", (ctx) => {
    requireAuth(ctx);
    const app = db.prepare(
      `SELECT a.*, j.title as job_title, j.company_id, cp.full_name as candidate_name FROM applications a
       JOIN jobs j ON j.id = a.job_id JOIN candidate_profiles cp ON cp.id = a.candidate_id WHERE a.id = ?`
    ).get(ctx.params.id) as Row | undefined;
    if (!app) { sendJson(ctx.res, 404, { error: "Application not found" }); return; }
    const notes = db.prepare(`SELECT * FROM application_notes WHERE application_id = ? ORDER BY created_at DESC`).all(app.id);
    const history = db.prepare(`SELECT * FROM application_status_history WHERE application_id = ? ORDER BY created_at ASC`).all(app.id);
    sendJson(ctx.res, 200, { ...app, notes, history });
  });

  router.put("/api/applications/:id/status", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const app = db.prepare(`SELECT a.*, j.company_id, j.title as job_title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(ctx.params.id) as Row | undefined;
    if (!app) { sendJson(ctx.res, 404, { error: "Application not found" }); return; }
    if (!ownsJobsCompany(ctx, app.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    const { status, note } = ctx.body ?? {};
    if (!isOneOf(status, APPLICATION_STATUSES)) throw new ValidationError("Invalid status.");
    db.prepare(`UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, app.id);
    db.prepare(`INSERT INTO application_status_history (application_id, status, note, changed_by) VALUES (?,?,?,?)`).run(app.id, status, note ?? null, ctx.userId);
    const candidate = db.prepare(`SELECT user_id FROM candidate_profiles WHERE id = ?`).get(app.candidate_id) as Row;
    notify(candidate.user_id as number, "status_changed", `Application update: ${app.job_title}`, `Your application status changed to ${status.replace("_", " ")}.`, { applicationId: app.id });
    const eventByStatus: Record<string, string> = { shortlisted: "candidate_shortlisted", offer: "offer_sent", hired: "hire_completed" };
    if (eventByStatus[status]) trackEvent(eventByStatus[status], ctx.userId, "application", app.id as number);
    sendJson(ctx.res, 200, db.prepare(`SELECT * FROM applications WHERE id = ?`).get(app.id));
  });

  router.post("/api/applications/:id/withdraw", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const app = db.prepare(`SELECT * FROM applications WHERE id = ? AND candidate_id = ?`).get(ctx.params.id, profile.id) as Row | undefined;
    if (!app) { sendJson(ctx.res, 404, { error: "Application not found" }); return; }
    db.prepare(`UPDATE applications SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?`).run(app.id);
    db.prepare(`INSERT INTO application_status_history (application_id, status, changed_by) VALUES (?,'withdrawn',?)`).run(app.id, ctx.userId);
    sendJson(ctx.res, 200, { message: "Application withdrawn." });
  });

  router.post("/api/applications/:id/notes", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const app = db.prepare(`SELECT a.*, j.company_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(ctx.params.id) as Row | undefined;
    if (!app) { sendJson(ctx.res, 404, { error: "Application not found" }); return; }
    if (!ownsJobsCompany(ctx, app.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    const { note } = ctx.body ?? {};
    if (!isNonEmptyString(note)) throw new ValidationError("Note cannot be empty.");
    db.prepare(`INSERT INTO application_notes (application_id, author_id, note) VALUES (?,?,?)`).run(app.id, ctx.userId, note);
    sendJson(ctx.res, 201, { message: "Note added." });
  });

  router.put("/api/applications/:id/rate", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const app = db.prepare(`SELECT a.*, j.company_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(ctx.params.id) as Row | undefined;
    if (!app) { sendJson(ctx.res, 404, { error: "Application not found" }); return; }
    if (!ownsJobsCompany(ctx, app.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    const rating = toInt((ctx.body ?? {}).rating);
    if (rating == null || rating < 1 || rating > 5) throw new ValidationError("Rating must be 1-5.");
    db.prepare(`UPDATE applications SET rating = ? WHERE id = ?`).run(rating, app.id);
    sendJson(ctx.res, 200, { message: "Rated." });
  });

  // ---------------------------------------------------------------------
  // SAVED JOBS / SEARCHES
  // ---------------------------------------------------------------------
  router.post("/api/jobs/:id/save", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    db.prepare(`INSERT OR IGNORE INTO saved_jobs (candidate_id, job_id) VALUES (?,?)`).run(profile.id, ctx.params.id);
    trackEvent("job_save", ctx.userId, "job", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "Job saved." });
  });
  router.delete("/api/jobs/:id/save", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    db.prepare(`DELETE FROM saved_jobs WHERE candidate_id = ? AND job_id = ?`).run(profile.id, ctx.params.id);
    sendJson(ctx.res, 200, { message: "Job unsaved." });
  });
  router.get("/api/saved-jobs", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const rows = db.prepare(`SELECT j.*, c.name as company_name FROM saved_jobs sj JOIN jobs j ON j.id = sj.job_id JOIN companies c ON c.id = j.company_id WHERE sj.candidate_id = ?`).all(profile.id);
    sendJson(ctx.res, 200, { jobs: rows });
  });

  // Saved searches — closes the audited gap where the `saved_searches`
  // table existed in the schema but was never wired to any route.
  router.post("/api/saved-searches", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const { name, query } = ctx.body ?? {};
    if (!query || typeof query !== "object") throw new ValidationError("A search query is required.");
    const info = db.prepare(`INSERT INTO saved_searches (candidate_id, name, query_json) VALUES (?,?,?)`)
      .run(profile.id, isNonEmptyString(name, 100) ? name : null, JSON.stringify(query));
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM saved_searches WHERE id = ?`).get(info.lastInsertRowid));
  });
  router.get("/api/saved-searches", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    const rows = (db.prepare(`SELECT * FROM saved_searches WHERE candidate_id = ? ORDER BY created_at DESC`).all(profile.id) as Row[])
      .map((r) => ({ ...r, query: JSON.parse(r.query_json as string) }));
    sendJson(ctx.res, 200, { searches: rows });
  });
  router.delete("/api/saved-searches/:id", (ctx) => {
    requireRole(ctx, ["job_seeker"]);
    const profile = candidateProfileFor(ctx.userId!)!;
    db.prepare(`DELETE FROM saved_searches WHERE id = ? AND candidate_id = ?`).run(ctx.params.id, profile.id);
    sendJson(ctx.res, 200, { message: "Saved search removed." });
  });

  // ---------------------------------------------------------------------
  // INTERVIEWS
  // ---------------------------------------------------------------------
  router.post("/api/interviews", (ctx) => {
    requireRole(ctx, ["employer", "admin"]);
    const b = ctx.body ?? {};
    const app = db.prepare(`SELECT a.*, j.company_id, j.title as job_title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(b.applicationId) as Row | undefined;
    if (!app) throw new ValidationError("Application not found.");
    if (!ownsJobsCompany(ctx, app.company_id as number)) { sendJson(ctx.res, 403, { error: "Not your job posting" }); return; }
    if (!isOneOf(b.type, ["video", "phone", "physical", "technical", "hr", "panel"])) throw new ValidationError("Invalid interview type.");
    if (!isNonEmptyString(b.scheduledAt)) throw new ValidationError("scheduledAt is required.");
    const info = db.prepare(
      `INSERT INTO interviews (application_id, scheduled_by, scheduled_at, type, location_or_link, notes) VALUES (?,?,?,?,?,?)`
    ).run(app.id, ctx.userId, b.scheduledAt, b.type, b.locationOrLink ?? null, b.notes ?? null);
    db.prepare(`UPDATE applications SET status = 'interview', updated_at = datetime('now') WHERE id = ?`).run(app.id);
    db.prepare(`INSERT INTO application_status_history (application_id, status, changed_by) VALUES (?,'interview',?)`).run(app.id, ctx.userId);
    const candidate = db.prepare(`SELECT user_id FROM candidate_profiles WHERE id = ?`).get(app.candidate_id) as Row;
    notify(candidate.user_id as number, "interview_scheduled", `Interview scheduled: ${app.job_title}`, `An interview has been scheduled for ${b.scheduledAt}.`, { applicationId: app.id });
    trackEvent("interview_scheduled", ctx.userId, "application", app.id as number, { type: b.type });
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM interviews WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.get("/api/interviews", (ctx) => {
    const user = requireAuth(ctx);
    if (user.role === "job_seeker") {
      const profile = candidateProfileFor(ctx.userId!)!;
      const rows = db.prepare(
        `SELECT iv.*, a.job_id, j.title as job_title FROM interviews iv
         JOIN applications a ON a.id = iv.application_id JOIN jobs j ON j.id = a.job_id
         WHERE a.candidate_id = ? ORDER BY iv.scheduled_at ASC`
      ).all(profile.id);
      sendJson(ctx.res, 200, { interviews: rows });
    } else {
      const employer = db.prepare(`SELECT company_id FROM employer_profiles WHERE user_id = ?`).get(ctx.userId) as Row | undefined;
      const rows = db.prepare(
        `SELECT iv.*, a.job_id, j.title as job_title, cp.full_name as candidate_name FROM interviews iv
         JOIN applications a ON a.id = iv.application_id JOIN jobs j ON j.id = a.job_id JOIN candidate_profiles cp ON cp.id = a.candidate_id
         WHERE j.company_id = ? ORDER BY iv.scheduled_at ASC`
      ).all(employer?.company_id ?? -1);
      sendJson(ctx.res, 200, { interviews: rows });
    }
  });

  // ---------------------------------------------------------------------
  // MESSAGES
  // ---------------------------------------------------------------------
  router.post("/api/conversations", (ctx) => {
    const user = requireAuth(ctx);
    const { applicationId } = ctx.body ?? {};
    const app = db.prepare(
      `SELECT a.*, j.company_id, j.title as job_title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`
    ).get(applicationId) as Row | undefined;
    if (!app) throw new ValidationError("Application not found.");
    const candidate = db.prepare(`SELECT user_id FROM candidate_profiles WHERE id = ?`).get(app.candidate_id) as Row;
    const company = db.prepare(`SELECT owner_user_id FROM companies WHERE id = ?`).get(app.company_id) as Row;
    const isCandidate = candidate.user_id === ctx.userId;
    const isEmployer = ownsJobsCompany(ctx, app.company_id as number);
    // Messaging is only allowed between the two parties of a real
    // application — candidates can't message employers cold, and employers
    // can only reach candidates who actually applied to one of their jobs.
    if (!isCandidate && !isEmployer) { sendJson(ctx.res, 403, { error: "You are not part of this application." }); return; }
    let conv = db.prepare(
      `SELECT * FROM conversations WHERE application_id = ? AND candidate_user_id = ? AND employer_user_id = ?`
    ).get(app.id, candidate.user_id, company.owner_user_id) as Row | undefined;
    if (!conv) {
      const info = db.prepare(
        `INSERT INTO conversations (application_id, candidate_user_id, employer_user_id) VALUES (?,?,?)`
      ).run(app.id, candidate.user_id, company.owner_user_id);
      conv = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(info.lastInsertRowid) as Row;
    }
    sendJson(ctx.res, 201, conv);
  });

  router.get("/api/conversations", (ctx) => {
    const user = requireAuth(ctx);
    // Enriched with the other party's display name/photo (Phase 16: never
    // show raw IDs in the conversation list) — candidate name comes from
    // candidate_profiles, employer "name" is their company name since
    // employers are represented to candidates as their company.
    const rows = db.prepare(
      `SELECT c.*, cp.full_name as candidate_name, cp.photo_url as candidate_photo, co.name as company_name, co.logo_url as company_logo
       FROM conversations c
       JOIN candidate_profiles cp ON cp.user_id = c.candidate_user_id
       LEFT JOIN employer_profiles ep ON ep.user_id = c.employer_user_id
       LEFT JOIN companies co ON co.id = ep.company_id
       WHERE c.candidate_user_id = ? OR c.employer_user_id = ? ORDER BY c.created_at DESC`
    ).all(user.uid, user.uid) as Row[];
    const conversations = rows.map((r) => ({
      ...r,
      other_party_name: user.uid === r.candidate_user_id ? (r.company_name ?? "Employer") : r.candidate_name,
      other_party_photo: user.uid === r.candidate_user_id ? r.company_logo : r.candidate_photo
    }));
    sendJson(ctx.res, 200, { conversations });
  });

  router.post("/api/conversations/:id/messages", (ctx) => {
    const user = requireAuth(ctx);
    const conv = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!conv || (conv.candidate_user_id !== ctx.userId && conv.employer_user_id !== ctx.userId)) {
      sendJson(ctx.res, 403, { error: "Not part of this conversation" }); return;
    }
    const { body } = ctx.body ?? {};
    if (!isNonEmptyString(body, 4000)) throw new ValidationError("Message cannot be empty.");
    const info = db.prepare(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (?,?,?)`).run(conv.id, ctx.userId, body);
    const recipient = conv.candidate_user_id === ctx.userId ? conv.employer_user_id : conv.candidate_user_id;
    notify(recipient as number, "new_message", "New message", body.slice(0, 80));
    sendJson(ctx.res, 201, db.prepare(`SELECT * FROM messages WHERE id = ?`).get(info.lastInsertRowid));
  });

  router.get("/api/conversations/:id/messages", (ctx) => {
    const user = requireAuth(ctx);
    const conv = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(ctx.params.id) as Row | undefined;
    if (!conv || (conv.candidate_user_id !== user.uid && conv.employer_user_id !== user.uid)) {
      sendJson(ctx.res, 403, { error: "Not part of this conversation" }); return;
    }
    const rows = db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`).all(conv.id);
    db.prepare(`UPDATE messages SET read_at = datetime('now') WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL`).run(conv.id, user.uid);
    sendJson(ctx.res, 200, { messages: rows });
  });

  // ---------------------------------------------------------------------
  // NOTIFICATIONS
  // ---------------------------------------------------------------------
  router.get("/api/notifications", (ctx) => {
    const user = requireAuth(ctx);
    const rows = db.prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(user.uid);
    sendJson(ctx.res, 200, { notifications: rows });
  });
  router.post("/api/notifications/:id/read", (ctx) => {
    const user = requireAuth(ctx);
    db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`).run(ctx.params.id, user.uid);
    sendJson(ctx.res, 200, { message: "Marked as read." });
  });
  router.post("/api/notifications/read-all", (ctx) => {
    const user = requireAuth(ctx);
    db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`).run(user.uid);
    sendJson(ctx.res, 200, { message: "All marked as read." });
  });

  // ---------------------------------------------------------------------
  // REPORTS
  // ---------------------------------------------------------------------
  router.post("/api/reports", (ctx) => {
    const user = requireAuth(ctx);
    const { targetType, targetId, reason, details } = ctx.body ?? {};
    if (!isOneOf(targetType, ["job", "company", "user", "message"])) throw new ValidationError("Invalid target type.");
    if (!isNonEmptyString(reason, 200)) throw new ValidationError("Reason is required.");
    db.prepare(`INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?,?,?,?,?)`)
      .run(user.uid, targetType, toInt(targetId), reason, details ?? null);
    sendJson(ctx.res, 201, { message: "Report submitted. Our team will review it." });
  });

  // ---------------------------------------------------------------------
  // ADMIN
  // ---------------------------------------------------------------------
  router.get("/api/admin/stats", (ctx) => {
    requireRole(ctx, ["admin"]);
    const count = (sql: string) => (db.prepare(sql).get() as Row).n as number;
    sendJson(ctx.res, 200, {
      totalUsers: count(`SELECT COUNT(*) as n FROM users WHERE deleted_at IS NULL`),
      jobSeekers: count(`SELECT COUNT(*) as n FROM users WHERE role = 'job_seeker' AND deleted_at IS NULL`),
      employers: count(`SELECT COUNT(*) as n FROM users WHERE role = 'employer' AND deleted_at IS NULL`),
      activeJobs: count(`SELECT COUNT(*) as n FROM jobs WHERE status = 'published' AND deleted_at IS NULL`),
      applications: count(`SELECT COUNT(*) as n FROM applications`),
      interviews: count(`SELECT COUNT(*) as n FROM interviews`),
      hires: count(`SELECT COUNT(*) as n FROM applications WHERE status = 'hired'`),
      reportedContent: count(`SELECT COUNT(*) as n FROM reports WHERE status = 'pending'`),
      pendingCompanies: count(`SELECT COUNT(*) as n FROM companies WHERE status = 'pending'`)
    });
  });

  router.get("/api/admin/analytics", (ctx) => {
    requireRole(ctx, ["admin"]);
    const days = Math.min(90, toInt(ctx.query.get("days"), 30) ?? 30);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const byType = db.prepare(
      `SELECT event_type, COUNT(*) as count FROM analytics_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC`
    ).all(since);
    const dailySignups = db.prepare(
      `SELECT date(created_at) as day, COUNT(*) as count FROM users WHERE created_at >= ? GROUP BY day ORDER BY day ASC`
    ).all(since);
    const dailyApplications = db.prepare(
      `SELECT date(applied_at) as day, COUNT(*) as count FROM applications WHERE applied_at >= ? GROUP BY day ORDER BY day ASC`
    ).all(since);
    sendJson(ctx.res, 200, { windowDays: days, eventsByType: byType, dailySignups, dailyApplications });
  });

  router.get("/api/admin/users", (ctx) => {
    requireRole(ctx, ["admin"]);
    const role = ctx.query.get("role");
    const rows = role
      ? db.prepare(`SELECT id, email, role, status, email_verified, created_at FROM users WHERE role = ? AND deleted_at IS NULL ORDER BY created_at DESC`).all(role)
      : db.prepare(`SELECT id, email, role, status, email_verified, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`).all();
    sendJson(ctx.res, 200, { users: rows });
  });

  router.post("/api/admin/users/:id/suspend", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    db.prepare(`UPDATE users SET status = 'suspended' WHERE id = ?`).run(ctx.params.id);
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(ctx.params.id);
    logAdmin(admin.uid as number, "suspend_user", "user", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "User suspended." });
  });
  router.post("/api/admin/users/:id/restore", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    db.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(ctx.params.id);
    logAdmin(admin.uid as number, "restore_user", "user", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "User restored." });
  });
  router.delete("/api/admin/users/:id", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    db.prepare(`UPDATE users SET deleted_at = datetime('now') WHERE id = ?`).run(ctx.params.id);
    logAdmin(admin.uid as number, "delete_user", "user", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "User deleted." });
  });

  router.get("/api/admin/companies/pending", (ctx) => {
    requireRole(ctx, ["admin"]);
    sendJson(ctx.res, 200, { companies: db.prepare(`SELECT * FROM companies WHERE status = 'pending'`).all() });
  });
  router.post("/api/admin/companies/:id/approve", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    db.prepare(`UPDATE companies SET status = 'approved', verified = 1 WHERE id = ?`).run(ctx.params.id);
    logAdmin(admin.uid as number, "approve_company", "company", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "Company approved and verified." });
  });
  router.post("/api/admin/companies/:id/reject", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    db.prepare(`UPDATE companies SET status = 'rejected' WHERE id = ?`).run(ctx.params.id);
    logAdmin(admin.uid as number, "reject_company", "company", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "Company rejected." });
  });

  router.get("/api/admin/jobs/pending", (ctx) => {
    requireRole(ctx, ["admin"]);
    sendJson(ctx.res, 200, { jobs: db.prepare(`SELECT * FROM jobs WHERE status = 'draft'`).all() });
  });

  router.get("/api/admin/reports", (ctx) => {
    requireRole(ctx, ["admin"]);
    sendJson(ctx.res, 200, { reports: db.prepare(`SELECT * FROM reports ORDER BY created_at DESC`).all() });
  });
  router.post("/api/admin/reports/:id/resolve", (ctx) => {
    const admin = requireRole(ctx, ["admin"]);
    const { action } = ctx.body ?? {}; // "reviewed" | "dismissed"
    if (!isOneOf(action, ["reviewed", "dismissed"])) throw new ValidationError("Invalid action.");
    db.prepare(`UPDATE reports SET status = ? WHERE id = ?`).run(action, ctx.params.id);
    logAdmin(admin.uid as number, `report_${action}`, "report", Number(ctx.params.id));
    sendJson(ctx.res, 200, { message: "Report updated." });
  });

  router.get("/api/admin/logs", (ctx) => {
    requireRole(ctx, ["admin"]);
    sendJson(ctx.res, 200, { logs: db.prepare(`SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 200`).all() });
  });

  router.get("/api/health", (ctx) => {
    try {
      db.prepare("SELECT 1").get();
      sendJson(ctx.res, 200, { status: "ok", db: "connected" });
    } catch (err: any) {
      sendJson(ctx.res, 503, { status: "error", error: err?.message ?? "Database unavailable" });
    }
  });

  router.get("/api/industries", (ctx) => sendJson(ctx.res, 200, { industries: db.prepare(`SELECT * FROM industries ORDER BY name`).all() }));
  router.get("/api/job-categories", (ctx) => sendJson(ctx.res, 200, { categories: db.prepare(`SELECT * FROM job_categories ORDER BY name`).all() }));
  router.get("/api/skills", (ctx) => sendJson(ctx.res, 200, { skills: db.prepare(`SELECT * FROM skills ORDER BY name LIMIT 200`).all() }));

  return router;
}

// Thrown internally to short-circuit a handler after a response has already
// been written by requireAuth/requireRole/limited.
class Halt extends Error { }
type Row = Record<string, any>;
