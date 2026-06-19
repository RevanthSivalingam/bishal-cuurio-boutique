"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// The inline script in app/layout.tsx pins `light`/`dark` on <html> before paint.
// This control just flips that choice and persists it.
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Sync UI from the class the pre-paint script already pinned on <html>.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    const root = document.documentElement.classList;
    root.toggle("dark", next);
    root.toggle("light", !next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage blocked — preference just won't persist
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="p-2 -mr-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {/* Render nothing until mounted so SSR markup matches the pinned class */}
      {dark === null ? (
        <span className="block size-5" aria-hidden="true" />
      ) : dark ? (
        <Sun className="size-5" />
      ) : (
        <Moon className="size-5" />
      )}
    </button>
  );
}
