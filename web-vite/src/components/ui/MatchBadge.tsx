export function MatchBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const tier = score >= 80 ? "great" : score >= 55 ? "good" : "low";
  return (
    <div className={`match-badge match-${tier}`}>
      <strong>{score}%</strong>
      <span>match</span>
    </div>
  );
}
