import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "campusmart-theme";
const PAPER = "#f6f2ea";
const NIGHT = "#131410";

function readStoredTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Night mode is a single class on <html>. The palette swaps in the stylesheet;
 * all this hook does is remember the choice and keep the browser chrome in step.
 */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(readStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");

    const meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", theme === "dark" ? NIGHT : PAPER);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage is optional — the class above still applies */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme, isDark: theme === "dark" };
}
