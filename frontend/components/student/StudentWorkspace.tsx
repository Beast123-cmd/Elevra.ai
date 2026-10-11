"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { StudentNav } from "@/components/student/StudentNav";
import { useStudentProfile } from "@/components/student/useStudentProfile";

export function StudentWorkspace({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const router = useRouter();
  const { state } = useStudentProfile();
  const profile = state.status === "ready" ? state.profile : null;
  const displayName = profile?.name ?? "Student";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";

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
    <div className={`min-h-screen bg-slate-50 md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out ${collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]"}`}>
      <StudentNav
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <div className="min-w-0">
        <header className="relative z-20 flex min-h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 lg:px-10 md:sticky md:top-0 md:bg-white/95 md:backdrop-blur-sm">
          {signOutError && <span role="alert" className="text-xs text-red-700">Couldn&apos;t sign out. Try again.</span>}
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf3ef] text-xs font-bold text-[#18574e]">{initials}</span>
            <div className="hidden min-w-0 min-[360px]:block">
              <p className="max-w-32 truncate text-xs font-semibold leading-4 text-[#172824] sm:max-w-48 sm:text-sm sm:leading-5">{displayName}</p>
              <p className="text-[11px] leading-4 text-slate-500">{profile ? `${profile.department} · Year ${profile.year}` : "Student account"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="min-h-10 shrink-0 gap-2 px-2.5 text-slate-600" onClick={signOut} disabled={signingOut} aria-label={signingOut ? "Signing out" : "Sign out"}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
          </Button>
        </header>
        {children}
      </div>
    </div>
  );
}
