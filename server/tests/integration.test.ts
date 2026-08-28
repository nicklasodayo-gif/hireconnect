import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openDb } from "../src/db.ts";
import { buildApp } from "../src/app.ts";
import { sendJson } from "../src/router.ts";
import { hashPassword } from "../src/auth.ts";

// Every test in this file runs against one real HTTP server (backed by a
// fresh in-memory SQLite DB) started once for the whole suite, exercising
// the actual network + routing + DB stack end to end via fetch().
const db = openDb(":memory:");
const router = buildApp(db);
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const handled = await router.dispatch(req, res);
  if (!handled) sendJson(res, 404, { error: "Not found" });
});

let base = "";
test.before(async () => {
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
  // Seed a pre-approved admin directly (bypassing registration, which never
  // allows creating admins over the API — this mirrors how a real deploy
  // would provision its first admin via a migration/seed script).
  db.prepare(`INSERT INTO users (email, password_hash, role, email_verified, status) VALUES (?,?,?,1,'active')`)
    .run("admin@test.dev", hashPassword("AdminPass123!"), "admin");
});
test.after(() => server.close());

async function json(path: string, opts: RequestInit = {}) {
  const res = await fetch(base + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) }
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

let candidateToken = "";
let employerToken = "";
let adminToken = "";
let jobId = 0;
let applicationId = 0;

test("candidate can register and log in", async () => {
  const reg = await json("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "jane@test.dev", password: "Password123!", role: "job_seeker", fullName: "Jane Wanjiru" })
  });
  assert.equal(reg.status, 201);

  const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "jane@test.dev", password: "Password123!" }) });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);
  candidateToken = login.body.token;
});

test("rejects login with wrong password", async () => {
  const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "jane@test.dev", password: "wrong-password" }) });
  assert.equal(login.status, 400);
});

test("candidate can update profile and add a skill", async () => {
  const update = await json("/api/candidates/me", {
    method: "PUT",
    headers: { Authorization: `Bearer ${candidateToken}` },
    body: JSON.stringify({ headline: "Backend Engineer", bio: "I build things.", yearsExperience: 3, preferredLocation: "Nairobi", preferredJobType: "full_time", expectedSalaryMin: 100000, expectedSalaryMax: 160000 })
  });
  assert.equal(update.status, 200);
  assert.equal(update.body.headline, "Backend Engineer");

  const skill = await json("/api/candidates/me/skills", {
    method: "POST", headers: { Authorization: `Bearer ${candidateToken}` }, body: JSON.stringify({ name: "TypeScript" })
  });
  assert.equal(skill.status, 201);
  assert.ok(skill.body.profile_completion > 0);
});

test("employer can register, create a company and post a job", async () => {
  const reg = await json("/api/auth/register", {
    method: "POST", body: JSON.stringify({ email: "recruiter@acme.dev", password: "Password123!", role: "employer" })
  });
  assert.equal(reg.status, 201);
  const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "recruiter@acme.dev", password: "Password123!" }) });
  employerToken = login.body.token;

  const company = await json("/api/companies", {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` }, body: JSON.stringify({ name: "Acme Kenya", location: "Nairobi, Kenya" })
  });
  assert.equal(company.status, 201);

  const myCompanyAfterCreate = await json("/api/employers/me/company", { headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(myCompanyAfterCreate.status, 200);
  assert.equal(myCompanyAfterCreate.body.company.name, "Acme Kenya", "employer's company-profile form should be able to load its own existing company");

  const job = await json("/api/jobs", {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` },
    body: JSON.stringify({
      title: "Backend Engineer", description: "Build our API.", employmentType: "full_time", workMode: "hybrid",
      location: "Nairobi, Kenya", experienceLevel: "mid", salaryMin: 100000, salaryMax: 150000, skills: ["TypeScript", "Node.js"], status: "draft"
    })
  });
  assert.equal(job.status, 201);
  assert.equal(job.body.status, "draft");
  jobId = job.body.id;

  const publish = await json(`/api/jobs/${jobId}/publish`, { method: "POST", headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(publish.status, 200);
  assert.equal(publish.body.status, "published");
});

test("job search returns the published job with a match score for the candidate", async () => {
  const search = await json("/api/jobs?q=Backend", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(search.status, 200);
  assert.ok(search.body.jobs.length >= 1);
  const found = search.body.jobs.find((j: any) => j.id === jobId);
  assert.ok(found, "job should appear in search results");
  assert.ok(typeof found.matchScore === "number");
  assert.ok(found.matchScore > 0, "candidate with matching skill should score above 0");
});

test("candidate can apply, and the employer sees it in their ATS pipeline", async () => {
  const apply = await json(`/api/jobs/${jobId}/apply`, {
    method: "POST", headers: { Authorization: `Bearer ${candidateToken}` }, body: JSON.stringify({ coverNote: "I'd love to join!" })
  });
  assert.equal(apply.status, 201);
  applicationId = apply.body.id;

  const duplicate = await json(`/api/jobs/${jobId}/apply`, { method: "POST", headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(duplicate.status, 400, "should not allow applying twice");

  const employerApps = await json("/api/applications", { headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(employerApps.status, 200);
  assert.ok(employerApps.body.applications.some((a: any) => a.id === applicationId));

  const candidateApps = await json("/api/applications", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.ok(candidateApps.body.applications.some((a: any) => a.id === applicationId));
});

test("employer can move the application through the ATS pipeline and the candidate is notified", async () => {
  const shortlist = await json(`/api/applications/${applicationId}/status`, {
    method: "PUT", headers: { Authorization: `Bearer ${employerToken}` }, body: JSON.stringify({ status: "shortlisted" })
  });
  assert.equal(shortlist.status, 200);
  assert.equal(shortlist.body.status, "shortlisted");

  const interview = await json("/api/interviews", {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` },
    body: JSON.stringify({ applicationId, type: "video", scheduledAt: "2026-09-01T10:00:00Z", locationOrLink: "https://meet.example/1" })
  });
  assert.equal(interview.status, 201);

  const detail = await json(`/api/applications/${applicationId}`, { headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(detail.body.status, "interview");
  assert.equal(detail.body.history.length, 3); // applied -> shortlisted -> interview

  const notifications = await json("/api/notifications", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.ok(notifications.body.notifications.some((n: any) => n.type === "interview_scheduled"));
});

test("candidate outside the employer's company cannot change application status", async () => {
  const res = await json(`/api/applications/${applicationId}/status`, {
    method: "PUT", headers: { Authorization: `Bearer ${candidateToken}` }, body: JSON.stringify({ status: "hired" })
  });
  assert.equal(res.status, 403);
});

test("unauthenticated requests to protected routes are rejected", async () => {
  const res = await json("/api/candidates/me");
  assert.equal(res.status, 401);
});

test("candidate can save, list, and remove a saved search", async () => {
  const create = await json("/api/saved-searches", {
    method: "POST", headers: { Authorization: `Bearer ${candidateToken}` },
    body: JSON.stringify({ name: "Nairobi backend roles", query: { q: "Backend", location: "Nairobi", employmentType: "full_time" } })
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.name, "Nairobi backend roles");

  const list = await json("/api/saved-searches", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(list.status, 200);
  assert.equal(list.body.searches.length, 1);
  assert.deepEqual(list.body.searches[0].query, { q: "Backend", location: "Nairobi", employmentType: "full_time" });

  const remove = await json(`/api/saved-searches/${create.body.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(remove.status, 200);
  const listAfter = await json("/api/saved-searches", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(listAfter.body.searches.length, 0);

  const missingQuery = await json("/api/saved-searches", {
    method: "POST", headers: { Authorization: `Bearer ${candidateToken}` }, body: JSON.stringify({ name: "no query" })
  });
  assert.equal(missingQuery.status, 400);
});

test("job posting accepts Kenyan-specific employment types (attachment, graduate_trainee, freelance, temporary)", async () => {
  for (const employmentType of ["attachment", "graduate_trainee", "freelance", "temporary"]) {
    const job = await json("/api/jobs", {
      method: "POST", headers: { Authorization: `Bearer ${employerToken}` },
      body: JSON.stringify({ title: `Test ${employmentType}`, description: "desc", employmentType, workMode: "onsite", location: "Nairobi, Kenya" })
    });
    assert.equal(job.status, 201, `expected ${employmentType} to be accepted`);
  }
  const rejected = await json("/api/jobs", {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` },
    body: JSON.stringify({ title: "Bad type", description: "desc", employmentType: "not_a_real_type", workMode: "onsite" })
  });
  assert.equal(rejected.status, 400);
});

test("admin can log in and see platform-wide stats reflecting seeded activity", async () => {
  const login = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@test.dev", password: "AdminPass123!" }) });
  assert.equal(login.status, 200);
  adminToken = login.body.token;

  const stats = await json("/api/admin/stats", { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(stats.status, 200);
  assert.ok(stats.body.totalUsers >= 3);
  assert.ok(stats.body.applications >= 1);
});

test("non-admin cannot access admin routes", async () => {
  const res = await json("/api/admin/stats", { headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(res.status, 403);
});

test("candidate and employer can message each other about an application, but a stranger cannot", async () => {
  const conv = await json("/api/conversations", {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` }, body: JSON.stringify({ applicationId })
  });
  assert.equal(conv.status, 201);
  const convId = conv.body.id;

  const send = await json(`/api/conversations/${convId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${employerToken}` }, body: JSON.stringify({ body: "Thanks for applying — are you free for a quick call?" })
  });
  assert.equal(send.status, 201);

  const candidateConvs = await json("/api/conversations", { headers: { Authorization: `Bearer ${candidateToken}` } });
  const found = candidateConvs.body.conversations.find((c: any) => c.id === convId);
  assert.ok(found, "conversation should appear in the candidate's list");
  assert.equal(found.other_party_name, "Acme Kenya", "candidate should see the employer's company name, not a raw ID");

  const employerConvs = await json("/api/conversations", { headers: { Authorization: `Bearer ${employerToken}` } });
  const foundForEmployer = employerConvs.body.conversations.find((c: any) => c.id === convId);
  assert.equal(foundForEmployer.other_party_name, "Jane Wanjiru", "employer should see the candidate's real name, not a raw ID");

  const outsiderReg = await json("/api/auth/register", { method: "POST", body: JSON.stringify({ email: "stranger@test.dev", password: "Password123!", role: "job_seeker" }) });
  assert.equal(outsiderReg.status, 201);
  const outsiderLogin = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "stranger@test.dev", password: "Password123!" }) });
  const outsiderToken = outsiderLogin.body.token;

  const blocked = await json(`/api/conversations/${convId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${outsiderToken}` }, body: JSON.stringify({ body: "Let me in" })
  });
  assert.equal(blocked.status, 403);
});

test("health endpoint reports ok and a connected database", async () => {
  const res = await fetch(base + "/api/health");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.db, "connected");
});

test("dev-only tokens are included outside production and omitted in production", async () => {
  const prevEnv = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    const reg = await json("/api/auth/register", { method: "POST", body: JSON.stringify({ email: "devtoken@test.dev", password: "Password123!", role: "job_seeker" }) });
    assert.ok(reg.body.devVerificationToken, "expected a dev verification token outside production");

    process.env.NODE_ENV = "production";
    const reg2 = await json("/api/auth/register", { method: "POST", body: JSON.stringify({ email: "devtoken2@test.dev", password: "Password123!", role: "job_seeker" }) });
    assert.equal(reg2.body.devVerificationToken, undefined, "must not leak a verification token in production");
  } finally {
    if (prevEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevEnv;
  }
});

test("email verification: token from registration verifies the account", async () => {
  const reg = await json("/api/auth/register", { method: "POST", body: JSON.stringify({ email: "verify@test.dev", password: "Password123!", role: "job_seeker" }) });
  const verify = await json("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token: reg.body.devVerificationToken }) });
  assert.equal(verify.status, 200);
  const badVerify = await json("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token: "not-a-real-token" }) });
  assert.equal(badVerify.status, 400);
});

test("forgot-password / reset-password flow: old password stops working, new one works, old sessions are revoked", async () => {
  await json("/api/auth/register", { method: "POST", body: JSON.stringify({ email: "resetme@test.dev", password: "OldPassword123!", role: "job_seeker" }) });
  const login1 = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "resetme@test.dev", password: "OldPassword123!" }) });
  const oldToken = login1.body.token;

  const forgot = await json("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: "resetme@test.dev" }) });
  assert.equal(forgot.status, 200);
  assert.ok(forgot.body.devResetToken);

  const reset = await json("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: forgot.body.devResetToken, password: "NewPassword456!" }) });
  assert.equal(reset.status, 200);

  const oldSessionCheck = await json("/api/auth/me", { headers: { Authorization: `Bearer ${oldToken}` } });
  assert.equal(oldSessionCheck.status, 401, "old sessions must be revoked after a password reset");

  const oldLoginAttempt = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "resetme@test.dev", password: "OldPassword123!" }) });
  assert.equal(oldLoginAttempt.status, 400);

  const newLogin = await json("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "resetme@test.dev", password: "NewPassword456!" }) });
  assert.equal(newLogin.status, 200);

  const reusedResetToken = await json("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: forgot.body.devResetToken, password: "AnotherOne789!" }) });
  assert.equal(reusedResetToken.status, 400, "a reset token must not be usable twice");
});

test("CORS: reflects request Origin when no allowlist is configured outside production", async () => {
  const res = await fetch(base + "/api/jobs", { headers: { Origin: "http://example.test" } });
  assert.equal(res.headers.get("access-control-allow-origin"), "http://example.test");
});

test("real analytics events are recorded for job views, saves, applies, and pipeline transitions", async () => {
  await json(`/api/jobs/${jobId}`, { headers: { Authorization: `Bearer ${candidateToken}` } }); // job_view
  await json(`/api/jobs?q=Backend`, { headers: { Authorization: `Bearer ${candidateToken}` } }); // search

  const analytics = await json("/api/admin/analytics?days=30", { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(analytics.status, 200);
  const types = analytics.body.eventsByType.map((e: any) => e.event_type);
  for (const expected of ["job_view", "search", "job_apply", "candidate_shortlisted", "interview_scheduled"]) {
    assert.ok(types.includes(expected), `expected "${expected}" to have been tracked, got: ${types.join(", ")}`);
  }
  assert.ok(analytics.body.dailySignups.length > 0);
  assert.ok(analytics.body.dailyApplications.length > 0);
});

test("employer dashboard reports qualified applicants and offers using real match scores and statuses", async () => {
  const dash = await json("/api/employers/me/dashboard", { headers: { Authorization: `Bearer ${employerToken}` } });
  assert.equal(dash.status, 200);
  assert.ok(typeof dash.body.qualifiedApplicants === "number");
  assert.ok(typeof dash.body.offers === "number");
});

test("logout invalidates the session token", async () => {
  const logout = await json("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(logout.status, 200);
  const after = await json("/api/candidates/me", { headers: { Authorization: `Bearer ${candidateToken}` } });
  assert.equal(after.status, 401);
});
