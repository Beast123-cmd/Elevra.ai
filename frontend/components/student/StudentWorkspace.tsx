"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { StudentNav } from "@/components/student/StudentNav";
import { useStudentProfile } from "@/components/student/useStudentProfile";

export function StudentWorkspace({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const router = useRouter();
  const { state } = useStudentProfile();
  const profile = state.status === "ready" ? state.profile : null;
  const displayName = profile?.name ?? "Student";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";

  useEffect(() => {
    try {
      if (window.localStorage.getItem("elevra-student-theme") === "dark") setTheme("dark");
    } catch {
      // Keep the default light theme when browser storage is unavailable.
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      window.localStorage.setItem("elevra-student-theme", next);
    } catch {
      // The theme still changes for this session when storage is unavailable.
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
      setSignOutError(true);
    }
  }

  return (
    <div data-student-theme={theme} className={`min-h-screen bg-[#f5f6f1] text-[#25332e] transition-colors duration-200 ${theme === "dark" ? "dark" : ""} md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out ${collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]"}`}>
      <StudentNav
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <div className="min-w-0">
        <header className="flex min-h-14 items-center justify-end gap-2 border-b border-[#e0e5dd] bg-[#fbfcf8] px-3 py-2 sm:gap-3 sm:px-6 lg:px-10 dark:border-[#35463f] dark:bg-[#17231f]">
          {signOutError && <span role="alert" className="text-xs text-red-700">Couldn&apos;t sign out. Try again.</span>}
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6f0e9] text-xs font-bold text-[#18574e] dark:bg-[#2b4238] dark:text-[#c5ded1]">{initials}</span>
            <div className="hidden min-w-0 min-[360px]:block">
              <p className="max-w-32 truncate text-xs font-semibold leading-4 text-[#172824] dark:text-[#e7eee9] sm:max-w-48 sm:text-sm sm:leading-5">{displayName}</p>
              <p className="text-[11px] leading-4 text-slate-500 dark:text-[#a9b9b0]">{profile ? `${profile.department} · Year ${profile.year}` : "Student account"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-[#52665d] hover:bg-[#edf1e9] dark:text-[#c2d1c9] dark:hover:bg-[#263630]" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="sm" className="min-h-10 shrink-0 gap-2 px-2.5 text-slate-600 dark:text-[#c2d1c9]" onClick={signOut} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden min-[440px]:inline dark:text-[#c2d1c9]">{signingOut ? "Signing out…" : "Sign out"}</span>
          </Button>
        </header>
        {children}
      </div>
      <style jsx global>{`
        [data-student-theme="light"] { background-color: #f5f6f1; color: #25332e; }
        [data-student-theme="light"] [class~="bg-white"] { background-color: #fffefa !important; }
        [data-student-theme="dark"] { background-color: #111a17; color: #e3ebe6; color-scheme: dark; }
        [data-student-theme="dark"] [class*="bg-white"],
        [data-student-theme="dark"] [class*="bg-slate-50"],
        [data-student-theme="dark"] [class*="bg-slate-100"],
        [data-student-theme="dark"] [class*="bg-slate-200"],
        [data-student-theme="dark"] [class*="bg-[#f"],
        [data-student-theme="dark"] [class*="bg-[#e"],
        [data-student-theme="dark"] [class*="bg-[#dcece4"],
        [data-student-theme="dark"] [class*="bg-amber-50"],
        [data-student-theme="dark"] [class*="bg-amber-100"],
        [data-student-theme="dark"] [class*="bg-red-50"],
        [data-student-theme="dark"] [class*="bg-red-100"],
        [data-student-theme="dark"] [class*="bg-rose-50"],
        [data-student-theme="dark"] [class*="bg-rose-100"],
        [data-student-theme="dark"] [class*="bg-emerald-50"],
        [data-student-theme="dark"] [class*="bg-emerald-100"],
        [data-student-theme="dark"] [class*="bg-teal-50"] { background-color: #1d2b26 !important; }
        [data-student-theme="dark"] [class*="border-slate-100"],
        [data-student-theme="dark"] [class*="border-slate-200"],
        [data-student-theme="dark"] [class*="border-[#d"],
        [data-student-theme="dark"] [class*="border-[#e"],
        [data-student-theme="dark"] [class*="border-[#b"] { border-color: #3a4d44 !important; }
        [data-student-theme="dark"] [class*="text-[#172824"],
        [data-student-theme="dark"] [class*="text-[#25332e"],
        [data-student-theme="dark"] [class*="text-slate-900"],
        [data-student-theme="dark"] [class*="text-slate-800"],
        [data-student-theme="dark"] [class*="text-slate-700"],
        [data-student-theme="dark"] [class*="text-slate-600"] { color: #dce7e1 !important; }
        [data-student-theme="dark"] [class*="text-teal-900"],
        [data-student-theme="dark"] [class*="text-teal-800"],
        [data-student-theme="dark"] [class*="text-[#18574e"],
        [data-student-theme="dark"] [class*="text-[#15564e"],
        [data-student-theme="dark"] [class*="text-[#286a62"],
        [data-student-theme="dark"] [class*="text-[#1d6158"],
        [data-student-theme="dark"] [class*="text-[#23634f"],
        [data-student-theme="dark"] [class*="text-[#315c50"] { color: #abd4c1 !important; }
        [data-student-theme="dark"] [class*="text-slate-500"],
        [data-student-theme="dark"] [class*="text-slate-400"],
        [data-student-theme="dark"] [class*="text-[#718078"],
        [data-student-theme="dark"] [class*="text-[#5d8177"] { color: #a9b9b0 !important; }
        [data-student-theme="dark"] [class*="text-amber-800"],
        [data-student-theme="dark"] [class*="text-amber-700"] { color: #ebc68b !important; }
        [data-student-theme="dark"] [class*="text-red-800"],
        [data-student-theme="dark"] [class*="text-red-700"],
        [data-student-theme="dark"] [class*="text-rose-800"],
        [data-student-theme="dark"] [class*="text-rose-700"] { color: #f1aaa1 !important; }
        [data-student-theme="dark"] [class*="text-emerald-800"],
        [data-student-theme="dark"] [class*="text-emerald-700"] { color: #a9d8b7 !important; }
        [data-student-theme="dark"] input:not([type="checkbox"]),
        [data-student-theme="dark"] textarea,
        [data-student-theme="dark"] select { background-color: #17231f; color: #e3ebe6; }
        [data-student-theme="dark"] input::placeholder,
        [data-student-theme="dark"] textarea::placeholder { color: #91a399; }
      `}</style>
    </div>
  );
}
