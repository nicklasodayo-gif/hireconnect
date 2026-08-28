// Deterministic, explainable job-matching engine.
//
// This is intentionally NOT machine-learned — it's a transparent weighted
// score so every match can show "why this job matches you" with concrete
// reasons. The public shape (MatchInput -> MatchResult) is the seam where a
// future ML/AI recommender could be swapped in without touching callers;
// see docs/ARCHITECTURE.md "Matching engine".

export interface MatchCandidate {
  skills: string[];
  yearsExperience: number;
  preferredLocation?: string | null;
  preferredWorkMode?: string | null;
  preferredJobType?: string | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  highestEducationLevel?: EducationLevel | null;
}

export interface MatchJob {
  requiredSkills: string[];
  niceToHaveSkills?: string[];
  experienceLevel: "entry" | "mid" | "senior" | "executive";
  location?: string | null;
  workMode?: "remote" | "hybrid" | "onsite" | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  educationRequirement?: EducationLevel | null;
}

export type EducationLevel = "none" | "certificate" | "diploma" | "bachelor" | "master" | "phd";

const EDUCATION_RANK: Record<EducationLevel, number> = {
  none: 0, certificate: 1, diploma: 2, bachelor: 3, master: 4, phd: 5
};

const EXPERIENCE_YEARS_FOR_LEVEL: Record<MatchJob["experienceLevel"], [number, number]> = {
  entry: [0, 2],
  mid: [2, 5],
  senior: [5, 10],
  executive: [8, 99]
};

export interface MatchComponent { score: number; label: string; }

export interface MatchResult {
  overall: number;
  skills: MatchComponent & { matched: string[]; missing: string[]; total: number };
  experience: MatchComponent;
  location: MatchComponent;
  education: MatchComponent;
  salary: MatchComponent;
  jobType: MatchComponent;
  reasons: string[];
}

const WEIGHTS = { skills: 0.35, experience: 0.2, location: 0.15, education: 0.1, salary: 0.1, jobType: 0.1 };

function norm(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

function scoreSkills(candidate: MatchCandidate, job: MatchJob): MatchResult["skills"] {
  const required = job.requiredSkills.map(norm);
  const have = new Set(candidate.skills.map(norm));
  const matched = required.filter(s => have.has(s));
  const missing = required.filter(s => !have.has(s));
  const total = required.length;
  const score = total === 0 ? 100 : Math.round((matched.length / total) * 100);
  return { score, label: `${matched.length}/${total} required skills`, matched, missing, total };
}

function scoreExperience(candidate: MatchCandidate, job: MatchJob): MatchComponent {
  const [min, max] = EXPERIENCE_YEARS_FOR_LEVEL[job.experienceLevel];
  const yrs = candidate.yearsExperience ?? 0;
  if (yrs >= min && yrs <= max) return { score: 100, label: `${yrs} years experience matches` };
  const distance = yrs < min ? min - yrs : yrs - max;
  const score = Math.max(0, Math.round(100 - distance * 20));
  return { score, label: yrs < min ? `${min - yrs} years below typical range` : `${yrs} years — more senior than typical range` };
}

function scoreLocation(candidate: MatchCandidate, job: MatchJob): MatchComponent {
  if (job.workMode === "remote") return { score: 100, label: "Remote — location flexible" };
  const pref = norm(candidate.preferredLocation);
  const jobLoc = norm(job.location);
  if (!pref || !jobLoc) return { score: 50, label: "Location preference not set" };
  if (pref === jobLoc || jobLoc.includes(pref) || pref.includes(jobLoc)) {
    return { score: 100, label: `${job.location} matches your location preference` };
  }
  return { score: 30, label: `${job.location} differs from your preferred ${candidate.preferredLocation}` };
}

function scoreEducation(candidate: MatchCandidate, job: MatchJob): MatchComponent {
  if (!job.educationRequirement || job.educationRequirement === "none") {
    return { score: 100, label: "No specific education requirement" };
  }
  const have = EDUCATION_RANK[candidate.highestEducationLevel ?? "none"];
  const need = EDUCATION_RANK[job.educationRequirement];
  if (have >= need) return { score: 100, label: `Meets ${job.educationRequirement} requirement` };
  const gap = need - have;
  return { score: Math.max(0, 100 - gap * 25), label: `Below the ${job.educationRequirement} requirement` };
}

function scoreSalary(candidate: MatchCandidate, job: MatchJob): MatchComponent {
  if (candidate.expectedSalaryMin == null && candidate.expectedSalaryMax == null) {
    return { score: 60, label: "Salary expectation not set" };
  }
  if (job.salaryMin == null && job.salaryMax == null) {
    return { score: 60, label: "Job salary not disclosed" };
  }
  const candMin = candidate.expectedSalaryMin ?? 0;
  const candMax = candidate.expectedSalaryMax ?? Number.MAX_SAFE_INTEGER;
  const jobMin = job.salaryMin ?? 0;
  const jobMax = job.salaryMax ?? Number.MAX_SAFE_INTEGER;
  const overlap = Math.min(candMax, jobMax) - Math.max(candMin, jobMin);
  if (overlap >= 0) return { score: 100, label: "Salary within your expected range" };
  // Distance-based falloff when ranges don't overlap.
  const gap = Math.abs(overlap);
  const scale = Math.max(candMin, jobMin, 1);
  const score = Math.max(0, Math.round(100 - (gap / scale) * 100));
  return { score, label: "Salary outside your expected range" };
}

function scoreJobType(candidate: MatchCandidate, job: MatchJob): MatchComponent {
  const pref = norm(candidate.preferredJobType);
  const type = norm(job.employmentType);
  if (!pref) return { score: 60, label: "Job type preference not set" };
  if (pref === type) return { score: 100, label: `${job.employmentType} matches your preference` };
  return { score: 40, label: `You prefer ${candidate.preferredJobType}, this role is ${job.employmentType}` };
}

export function calculateMatch(candidate: MatchCandidate, job: MatchJob): MatchResult {
  const skills = scoreSkills(candidate, job);
  const experience = scoreExperience(candidate, job);
  const location = scoreLocation(candidate, job);
  const education = scoreEducation(candidate, job);
  const salary = scoreSalary(candidate, job);
  const jobType = scoreJobType(candidate, job);

  const overall = Math.round(
    skills.score * WEIGHTS.skills +
    experience.score * WEIGHTS.experience +
    location.score * WEIGHTS.location +
    education.score * WEIGHTS.education +
    salary.score * WEIGHTS.salary +
    jobType.score * WEIGHTS.jobType
  );

  const reasons: string[] = [];
  if (skills.total > 0) reasons.push(`${skills.score >= 60 ? "✓" : "✗"} ${skills.label}`);
  if (experience.score >= 60) reasons.push(`✓ ${experience.label}`);
  if (location.score >= 80) reasons.push(`✓ ${location.label}`);
  if (salary.score >= 80) reasons.push(`✓ ${salary.label}`);
  if (education.score >= 80 && job.educationRequirement && job.educationRequirement !== "none") reasons.push(`✓ ${education.label}`);

  return { overall, skills, experience, location, education, salary, jobType, reasons };
}
