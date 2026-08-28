export type ProgressTone = "primary" | "good" | "warn" | "bad";

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: ProgressTone }) {
  return (
    <div className="progress-bar">
      <div className={`progress-fill tone-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
