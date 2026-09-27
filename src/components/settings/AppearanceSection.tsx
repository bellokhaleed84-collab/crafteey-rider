"use client";

import { useEffect, useState } from "react";

const KEY = "crafteey_rider_theme";
type Theme = "light" | "dark" | "system";

const OPTIONS: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Match system" },
];

export default function AppearanceSection() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    if (saved) setThemeState(saved);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem(KEY, t);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", t === "dark" || (t === "system" && prefersDark));
  }

  return (
    <div className="space-y-3">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setTheme(o.id)}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-sm font-semibold ${
            theme === o.id ? "border-brand bg-brand/5 text-brand" : "border-slate-200 bg-white text-brand"
          }`}
        >
          {o.label}
          {theme === o.id && <span>✓</span>}
        </button>
      ))}
      <p className="text-[11px] text-steel">
        This toggles a "dark" class on the page, but your Tailwind config needs{" "}
        <code>darkMode: &quot;class&quot;</code> plus dark-mode color classes across the app before this actually
        changes anything visually.
      </p>
    </div>
  );
}