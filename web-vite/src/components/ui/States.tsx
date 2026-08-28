import type { ReactNode } from "react";

export function Spinner() { return <div className="spinner" aria-label="Loading" />; }

export function LoadingSkeleton({ rows = 3, height = 18 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-block" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ height, width: i === rows - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export interface EmptyStateProps { icon?: string; title: string; body?: string; action?: ReactNode }
export function EmptyState({ icon = "📭", title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps { message?: string; onRetry?: () => void }
export function ErrorState({ message = "Something went wrong.", onRetry }: ErrorStateProps) {
  return (
    <div className="empty-state error-state">
      <div className="empty-icon">⚠️</div>
      <h3>We hit a snag</h3>
      <p>{message}</p>
      {onRetry && <button className="btn primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}
