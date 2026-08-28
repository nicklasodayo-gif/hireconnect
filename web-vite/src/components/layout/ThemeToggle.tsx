import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("hc_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("hc_theme", dark ? "dark" : "light");
  }, [dark]);
  return <button className="theme-toggle" title="Toggle theme" onClick={() => setDark((d) => !d)}>{dark ? "☀️" : "🌙"}</button>;
}
