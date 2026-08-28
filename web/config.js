// Change this if your API isn't running on localhost:4000 (e.g. deployed
// behind a domain) — see docs/README.md "Configuration".
window.API_BASE = window.API_BASE || "http://localhost:4000";

window.formatKES = function formatKES(min, max) {
  const fmt = (n) => "KES " + Number(n).toLocaleString("en-KE");
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return "Not disclosed";
};

window.timeAgo = function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

window.STATUS_LABELS = {
  applied: "Applied", screening: "Screening", shortlisted: "Shortlisted", interview: "Interview",
  offer: "Offer", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn"
};
window.STATUS_ORDER = ["applied", "screening", "shortlisted", "interview", "offer", "hired"];
