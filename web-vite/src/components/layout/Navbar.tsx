import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { NotifBell } from "./NotifBell";

export function Navbar() {
  const { user, logout } = useAuth();
  const dashHref = user?.role === "admin" ? "#/admin" : user?.role === "employer" ? "#/employer" : "#/dashboard";
  return (
    <header className="navbar">
      <a className="brand" href="#/">Hire<span>Connect</span></a>
      <nav className="nav-links">
        <a href="#/jobs">Find Jobs</a>
        <a href="#/companies">Companies</a>
        {user?.role === "employer" && <a href="#/employer/jobs">My Jobs</a>}
        {user?.role === "employer" && <a href="#/employer/ats">Applicants</a>}
      </nav>
      <div className="nav-actions">
        <ThemeToggle />
        {user && <NotifBell />}
        {user ? (
          <>
            <a className="btn ghost" href={dashHref}>Dashboard</a>
            <button className="btn subtle" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <a className="btn ghost" href="#/login">Log in</a>
            <a className="btn primary" href="#/register">Get Started</a>
          </>
        )}
      </div>
    </header>
  );
}
