import test from "node:test";
import assert from "node:assert/strict";
import { calculateMatch } from "../src/matching.ts";

test("strong match scores highly and lists positive reasons", () => {
  const result = calculateMatch(
    {
      skills: ["React", "TypeScript", "Node.js", "SQL"],
      yearsExperience: 3,
      preferredLocation: "Nairobi",
      preferredJobType: "full_time",
      expectedSalaryMin: 120000,
      expectedSalaryMax: 180000,
      highestEducationLevel: "bachelor"
    },
    {
      requiredSkills: ["React", "TypeScript", "Node.js"],
      experienceLevel: "mid",
      location: "Nairobi, Kenya",
      workMode: "hybrid",
      employmentType: "full_time",
      salaryMin: 100000,
      salaryMax: 160000,
      educationRequirement: "bachelor"
    }
  );
  assert.ok(result.overall >= 85, `expected high match, got ${result.overall}`);
  assert.equal(result.skills.matched.length, 3);
  assert.equal(result.skills.missing.length, 0);
  assert.ok(result.reasons.some(r => r.includes("3 years experience matches")));
});

test("weak match on skills and location scores lower with clear gaps listed", () => {
  const result = calculateMatch(
    {
      skills: ["Excel"],
      yearsExperience: 0,
      preferredLocation: "Mombasa",
      preferredJobType: "part_time",
      expectedSalaryMin: 200000,
      expectedSalaryMax: 250000,
      highestEducationLevel: "certificate"
    },
    {
      requiredSkills: ["React", "TypeScript", "Node.js", "GraphQL"],
      experienceLevel: "senior",
      location: "Nairobi, Kenya",
      workMode: "onsite",
      employmentType: "full_time",
      salaryMin: 80000,
      salaryMax: 120000,
      educationRequirement: "bachelor"
    }
  );
  assert.ok(result.overall < 40, `expected low match, got ${result.overall}`);
  assert.equal(result.skills.matched.length, 0);
  assert.equal(result.skills.missing.length, 4);
});

test("remote job ignores location mismatch", () => {
  const result = calculateMatch(
    { skills: [], yearsExperience: 2, preferredLocation: "Kisumu" },
    { requiredSkills: [], experienceLevel: "mid", location: "Nairobi", workMode: "remote" }
  );
  assert.equal(result.location.score, 100);
});

test("two different candidates against the same job produce different scores (no artificial clamping)", () => {
  const job = {
    requiredSkills: ["React", "TypeScript", "Node.js", "SQL", "AWS"],
    experienceLevel: "mid" as const,
    location: "Nairobi",
    workMode: "onsite" as const,
    employmentType: "full_time",
    salaryMin: 100000,
    salaryMax: 150000,
    educationRequirement: "bachelor" as const
  };
  const strong = calculateMatch({
    skills: ["React", "TypeScript", "Node.js", "SQL", "AWS"], yearsExperience: 3,
    preferredLocation: "Nairobi", preferredJobType: "full_time",
    expectedSalaryMin: 100000, expectedSalaryMax: 150000, highestEducationLevel: "bachelor"
  }, job);
  const weak = calculateMatch({
    skills: ["Photoshop"], yearsExperience: 8,
    preferredLocation: "Berlin", preferredJobType: "contract",
    expectedSalaryMin: 300000, expectedSalaryMax: 400000, highestEducationLevel: "none"
  }, job);
  assert.ok(strong.overall - weak.overall > 30, `expected clear separation, got ${strong.overall} vs ${weak.overall}`);
});
