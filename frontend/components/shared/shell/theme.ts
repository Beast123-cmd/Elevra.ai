"use client";

import { useCallback, useLayoutEffect, useState } from "react";

export type Theme = "light" | "dark";
type ThemePreference = Theme | "system";
const KEY = "elevra-theme";
const LEGACY_KEY = "elevra-student-theme";

function getPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Follow the device preference when browser storage is unavailable.
  }
  return "system";
}

function resolve(preference: ThemePreference, darkSystem: boolean): Theme {
  return preference === "system" ? (darkSystem ? "dark" : "light") : preference;
}

function apply(theme: Theme, preference: ThemePreference) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", preference === "light");
  root.style.colorScheme = theme;
}

/** Shared appearance preference. A stored Light/Dark choice wins; otherwise follow the device. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const preference = getPreference();
      const next = resolve(preference, media.matches);
      setTheme(next);
      apply(next, preference);
    };
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try { window.localStorage.setItem(KEY, next); } catch { /* Applies for this visit if storage is blocked. */ }
      apply(next, next);
      return next;
    });
  }, []);

  return [theme, toggle];
}
