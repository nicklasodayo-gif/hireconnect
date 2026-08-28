import { Avatar, MatchBadge } from "@/components/ui";

export interface CandidateCardProps {
  name: string;
  photo?: string | null;
  headline?: string | null;
  matchScore?: number | null;
  onClick?: () => void;
}

export function CandidateCard({ name, photo, headline, matchScore, onClick }: CandidateCardProps) {
  const content = (
    <>
      <div className="candidate-card-top">
        <Avatar src={photo} name={name} />
        <div><b>{name}</b>{headline && <small>{headline}</small>}</div>
      </div>
      <MatchBadge score={matchScore} />
    </>
  );
  return onClick
    ? <button className="candidate-card" onClick={onClick}>{content}</button>
    : <div className="candidate-card">{content}</div>;
}
