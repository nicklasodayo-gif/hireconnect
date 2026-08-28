import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { navigate } from "@/hooks/useHashRoute";

function AuthCard({ title, subtitle, children }: { title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <a className="brand" href="#/">Hire<span>Connect</span></a>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const user = await login(email, password);
      toast.show("Welcome back!", "success");
      navigate(user.role === "admin" ? "/admin" : user.role === "employer" ? "/employer" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally { setBusy(false); }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Log in to continue your job search or hiring.">
      <form onSubmit={submit}>
        {error && <div className="error-banner">⚠️ {error}</div>}
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn primary wide" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
      </form>
      <p className="muted small">No account? <a href="#/register">Register</a></p>
    </AuthCard>
  );
}

export function Register() {
  const { register, login } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState<"job_seeker" | "employer" | null>(null);
  const [form, setForm] = useState({ fullName: "", companyName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!role) {
    return (
      <AuthCard title={<>"How are you using HireConnect?"</>} subtitle="Choose the option that fits you — you can't change this later.">
        <div className="role-choice">
          <button className="role-card" onClick={() => setRole("job_seeker")}><span>🔎</span><b>I'm looking for a job</b><small>Build a profile and get matched to roles.</small></button>
          <button className="role-card" onClick={() => setRole("employer")}><span>🏢</span><b>I'm hiring</b><small>Post jobs and manage applicants.</small></button>
        </div>
        <p className="muted small">Already have an account? <a href="#/login">Log in</a></p>
      </AuthCard>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      await register({ email: form.email, password: form.password, role, fullName: form.fullName, companyName: form.companyName });
      await login(form.email, form.password);
      toast.show("Account created — let's set up your profile.", "success");
      navigate(role === "employer" ? "/employer/company" : "/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally { setBusy(false); }
  };

  return (
    <AuthCard title={role === "employer" ? "Create your employer account" : "Create your candidate account"}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">⚠️ {error}</div>}
        {role === "job_seeker"
          ? <label>Full name<input required value={form.fullName} onChange={set("fullName")} /></label>
          : <label>Company name<input required value={form.companyName} onChange={set("companyName")} /></label>}
        <label>Email<input type="email" required value={form.email} onChange={set("email")} /></label>
        <label>Password<input type="password" required minLength={8} value={form.password} onChange={set("password")} /></label>
        <button className="btn primary wide" disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button>
      </form>
      <button className="btn ghost wide" onClick={() => setRole(null)}>← Back</button>
    </AuthCard>
  );
}
