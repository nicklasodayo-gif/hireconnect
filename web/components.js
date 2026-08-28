const { useState, useEffect, useContext, createContext, useCallback, useRef } = React;

// --- Tiny hash router (no external router lib needed) ----------------
window.useHashRoute = function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
};
window.navigate = (path) => { window.location.hash = path; };

// --- Toast system -------------------------------------------------------
let toastListeners = [];
window.showToast = (message, kind = "info") => toastListeners.forEach((l) => l({ message, kind, id: Math.random() }));
function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const listener = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    toastListeners.push(listener);
    return () => { toastListeners = toastListeners.filter((l) => l !== listener); };
  }, []);
  return (
    <div className="toast-host">
      {toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>)}
    </div>
  );
}
window.ToastHost = ToastHost;

// --- Auth context ---------------------------------------------------------
const AuthContext = createContext(null);
window.AuthContext = AuthContext;
window.useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(window.getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.getToken();
    if (!token) { setLoading(false); return; }
    window.api.me().then((me) => { setUser((u) => ({ ...u, ...me })); setLoading(false); })
      .catch(() => { window.setToken(null); window.setStoredUser(null); setUser(null); setLoading(false); });
  }, []);

  const login = async (email, password) => {
    const res = await window.api.login({ email, password });
    window.setToken(res.token); window.setStoredUser(res.user); setUser(res.user);
    return res.user;
  };
  const register = async (body) => {
    await window.api.register(body);
  };
  const logout = async () => {
    try { await window.api.logout(); } catch { /* ignore */ }
    window.setToken(null); window.setStoredUser(null); setUser(null);
    window.navigate("/");
  };
  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
window.AuthProvider = AuthProvider;

// --- Layout: Navbar / Footer ----------------------------------------------
function ThemeToggle() {
  const [dark, setDark] = useState(localStorage.getItem("hc_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("hc_theme", dark ? "dark" : "light");
  }, [dark]);
  return <button className="theme-toggle" title="Toggle theme" onClick={() => setDark((d) => !d)}>{dark ? "☀️" : "🌙"}</button>;
}

function NotifBell() {
  const { user } = window.useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    window.api.notifications().then((r) => setCount(r.notifications.filter((n) => !n.read_at).length)).catch(() => {});
  }, [user]);
  if (!user) return null;
  return (
    <a className="notif-bell" href="#/notifications">
      🔔{count > 0 && <span className="notif-dot">{count}</span>}
    </a>
  );
}

function Navbar() {
  const { user, logout } = window.useAuth();
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
window.Navbar = Navbar;

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div><div className="brand">Hire<span>Connect</span></div><p>Connect Talent With Opportunity — built for Kenya's growing workforce.</p></div>
        <div><h4>For Job Seekers</h4><a href="#/jobs">Browse Jobs</a><a href="#/companies">Companies</a><a href="#/register">Create Profile</a></div>
        <div><h4>For Employers</h4><a href="#/register">Post a Job</a><a href="#/employer/jobs">Manage Jobs</a></div>
        <div><h4>Company</h4><a href="#/">About</a><a href="#/">Contact</a><a href="#/">Privacy</a></div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} HireConnect. All rights reserved.</div>
    </footer>
  );
}
window.Footer = Footer;

// --- Small reusable widgets ------------------------------------------------
function MatchBadge({ score }) {
  if (score == null) return null;
  const tier = score >= 80 ? "great" : score >= 55 ? "good" : "low";
  return <div className={`match-badge match-${tier}`}><strong>{score}%</strong><span>match</span></div>;
}
window.MatchBadge = MatchBadge;

function ProgressBar({ value, tone = "primary" }) {
  return <div className="progress-bar"><div className={`progress-fill tone-${tone}`} style={{ width: `${value}%` }} /></div>;
}
window.ProgressBar = ProgressBar;

function Badge({ children, tone = "neutral" }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
window.Badge = Badge;

function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>×</button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
window.Modal = Modal;

function EmptyState({ icon = "📭", title, body, action }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
window.EmptyState = EmptyState;

function Spinner() { return <div className="spinner" aria-label="Loading" />; }
window.Spinner = Spinner;

function StatusPill({ status }) {
  const tone = { applied: "neutral", screening: "info", shortlisted: "info", interview: "warn", offer: "good", hired: "good", rejected: "bad", withdrawn: "neutral" }[status] || "neutral";
  return <Badge tone={tone}>{window.STATUS_LABELS[status] || status}</Badge>;
}
window.StatusPill = StatusPill;

function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="error-banner">⚠️ {error}</div>;
}
window.ErrorBanner = ErrorBanner;

function RequireRole({ role, user, children }) {
  const roles = Array.isArray(role) ? role : [role];
  if (!user) return <EmptyState icon="🔒" title="Please log in" body="You need an account to view this page." action={<a className="btn primary" href="#/login">Log in</a>} />;
  if (!roles.includes(user.role)) return <EmptyState icon="🚫" title="Not available" body="This page isn't available for your account type." />;
  return children;
}
window.RequireRole = RequireRole;
