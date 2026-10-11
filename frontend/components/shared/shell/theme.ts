"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "elevra-theme";
const LEGACY_KEY = "elevra-student-theme";

function read(): Theme {
  try {
    const v = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    return v === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Light or dark for the whole app: the `dark` class on <html> switches every token in globals.css. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const t = read();
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // the theme still applies for this visit when storage is blocked
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
