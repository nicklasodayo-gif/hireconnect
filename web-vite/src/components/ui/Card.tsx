import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest} />;
}

export type BadgeTone = "neutral" | "good" | "warn" | "bad" | "info";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export interface AvatarProps { src?: string | null; name?: string; size?: number }
export function Avatar({ src, name, size = 36 }: AvatarProps) {
  const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {src ? <img src={src} alt={name || "avatar"} /> : <span>{initials}</span>}
    </div>
  );
}
