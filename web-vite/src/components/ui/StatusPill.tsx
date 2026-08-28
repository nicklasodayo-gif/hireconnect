import { Badge, type BadgeTone } from "./Card";
import { STATUS_LABELS } from "@/utils/format";
import type { ApplicationStatus } from "@/types";

const TONE_BY_STATUS: Record<ApplicationStatus, BadgeTone> = {
  applied: "neutral", screening: "info", shortlisted: "info", interview: "warn",
  offer: "good", hired: "good", rejected: "bad", withdrawn: "neutral"
};

export function StatusPill({ status }: { status: ApplicationStatus | string }) {
  const tone = TONE_BY_STATUS[status as ApplicationStatus] ?? "neutral";
  return <Badge tone={tone}>{STATUS_LABELS[status as ApplicationStatus] ?? status}</Badge>;
}
