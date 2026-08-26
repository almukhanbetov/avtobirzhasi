"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "avtobirzhasi_theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Only used for the very first visit, before the user has ever picked a
// theme themselves — see app/layout.tsx's inline beforeInteractive script,
// which applies this exact same logic to the DOM before React even
// hydrates, so there's no flash of the wrong theme on load.
function getStoredOrSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : getSystemTheme();
}

// Manual light/dark toggle that, once the user has touched it, no longer
// tracks the OS's prefers-color-scheme — the choice persists in
// localStorage across visits, independent of system settings.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always starts at "light", matching what the server rendered — reading
  // localStorage/matchMedia here instead would make the very first client
  // render disagree with the server (a real hydration error, since
  // ThemeToggle's icon/aria-pressed are rendered from this value, not just
  // a DOM class mutated outside React). The real value is applied a beat
  // later via the effect below, after hydration has already reconciled;
  // the page's actual colors are already correct from first paint via
  // app/layout.tsx's beforeInteractive script, so what's deferred here is
  // only the toggle button's own icon, not the whole page.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // One-time bridge from an external, non-reactive source (localStorage/
    // matchMedia) into React state on mount — the documented exception to
    // "don't setState in an effect" (react.dev: adjusting state to match
    // an external system after mount), not a cascading-render pattern:
    // empty deps, runs exactly once, never repeats.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(getStoredOrSystemTheme());
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
