import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type RegisterInput } from "@/api";
import { getStoredUser, getToken, setStoredUser, setToken } from "@/api/client";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (body: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser<AuthUser>());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((me) => setUser((u) => ({ ...(u as AuthUser), ...me })))
      .catch(() => { setToken(null); setStoredUser(null); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.token);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  };

  const register = async (body: RegisterInput) => { await authApi.register(body); };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore network errors on logout */ }
    setToken(null);
    setStoredUser(null);
    setUser(null);
    window.location.hash = "/";
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}
