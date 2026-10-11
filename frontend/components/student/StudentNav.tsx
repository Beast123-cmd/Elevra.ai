"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Award, Bell, BookOpen, House, LogOut, Mic2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/shared/Brand";

const LINKS = [
  { href: "/student", label: "Home", icon: House },
  { href: "/student/improve", label: "My plan", icon: BookOpen },
  { href: "/student/certifications", label: "Certifications", icon: Award },
  { href: "/student/hackathons", label: "Hackathons", icon: Trophy },
  { href: "/student/interview", label: "Mock interview", icon: Mic2 },
  { href: "/student/notifications", label: "Inbox", icon: Bell },
];

export function StudentNav() {
  const path = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

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
    <aside className="sticky top-0 z-30 flex min-w-0 flex-col border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur-sm md:sticky md:h-screen md:border-b-0 md:border-r md:bg-white md:px-3.5 md:py-5 md:backdrop-blur-none">
      <Link href="/student" className="flex h-9 shrink-0 items-center gap-2.5 px-2.5 text-slate-900 no-underline" aria-label="Elevra student home">
        <BrandMark compact />
        <span className="text-base font-semibold tracking-[-.045em]">elevra<span className="font-medium text-[#718078]">.ai</span></span>
      </Link>
      <p className="mb-2 mt-7 hidden px-2.5 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400 md:block">Student space</p>
      <nav aria-label="Student pages" className="mt-2 grid grid-cols-5 gap-1 md:mt-0 md:flex md:flex-col md:gap-1.5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/student" ? path === href : path.startsWith(href);
          const mobileLabel = { Home: "Home", "My plan": "Plan", Certifications: "Courses", "Mock interview": "Practice", Inbox: "Inbox" }[label] ?? label;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 text-[9px] font-medium no-underline transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 md:h-10 md:min-h-0 md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-0 md:text-[11px] ${active ? "bg-teal-50 text-teal-900 md:shadow-[inset_3px_0_0_#286a62]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-800" : "text-slate-400"}`} aria-hidden="true" />
              <span className="max-w-full truncate md:hidden">{mobileLabel}</span>
              <span className="hidden max-w-full truncate md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 md:mt-auto md:px-2.5 md:pt-4">
        <div className="hidden md:block">
          <p className="text-[10px] font-medium text-slate-700">Your student space</p>
          <p className="mt-0.5 text-[9px] text-slate-500">Your records and next steps</p>
        </div>
        {signOutError && <span role="alert" className="text-xs text-red-700">Couldn&apos;t sign out. Try again.</span>}
        <Button variant="ghost" size="sm" className="ml-auto min-h-11 text-slate-600" onClick={signOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
