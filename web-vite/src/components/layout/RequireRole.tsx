import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types";

export function RequireRole({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!user) {
    return <EmptyState icon="🔒" title="Please log in" body="You need an account to view this page." action={<a className="btn primary" href="#/login">Log in</a>} />;
  }
  if (!roles.includes(user.role)) {
    return <EmptyState icon="🚫" title="Not available" body="This page isn't available for your account type." />;
  }
  return <>{children}</>;
}
