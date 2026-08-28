import type { ApplicationStatus } from "@/types";

export function formatKES(min?: number | null, max?: number | null): string {
  const fmt = (n: number) => "KES " + n.toLocaleString("en-KE");
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return "Not disclosed";
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn"
};

export const STATUS_ORDER: ApplicationStatus[] = ["applied", "screening", "shortlisted", "interview", "offer", "hired"];

// Kenyan phone normalization: accepts 07xxxxxxxx, 01xxxxxxxx, 254xxxxxxxxx,
// +254xxxxxxxxx, and returns a canonical +254XXXXXXXXX form, or null if the
// input doesn't look like a Kenyan mobile number.
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let national: string | null = null;
  if (/^\+254\d{9}$/.test(digits)) national = digits.slice(4);
  else if (/^254\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  if (!national || !/^[17]\d{8}$/.test(national)) return null;
  return `+254${national}`;
}

export const KENYAN_COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Uasin Gishu", "Kajiado",
  "Nyeri", "Meru", "Kilifi", "Kakamega", "Bungoma", "Kericho", "Trans Nzoia", "Nyandarua",
  "Nyamira", "Kisii", "Homa Bay", "Migori", "Siaya", "Busia", "Vihiga", "Kwale", "Taita-Taveta",
  "Garissa", "Wajir", "Mandera", "Marsabit", "Isiolo", "Embu", "Tharaka-Nithi", "Kitui",
  "Makueni", "Nandi", "Baringo", "Laikipia", "Samburu", "Turkana", "West Pokot", "Elgeyo-Marakwet",
  "Narok", "Bomet", "Murang'a", "Kirinyaga", "Tana River", "Lamu"
];

export const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "attachment", label: "Attachment" },
  { value: "graduate_trainee", label: "Graduate Trainee" },
  { value: "freelance", label: "Freelance" },
  { value: "temporary", label: "Temporary" }
];
