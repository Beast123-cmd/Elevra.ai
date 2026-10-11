"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Bell, BookOpen, House, Menu, Mic2, PanelLeftClose, PanelLeftOpen, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shared/Brand";

const LINKS = [
  { href: "/student", label: "Home", icon: House },
  { href: "/student/improve", label: "My plan", icon: BookOpen },
  { href: "/student/certifications", label: "Certifications", icon: Award },
  { href: "/student/hackathons", label: "Hackathons", icon: Trophy },
  { href: "/student/interview", label: "Mock interview", icon: Mic2 },
  { href: "/student/notifications", label: "Inbox", icon: Bell },
];

export function StudentNav({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onToggleMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onToggleMobile: () => void;
}) {
  const path = usePathname();

  return (
    <aside className={`sticky top-0 z-30 flex min-w-0 flex-col border-b border-slate-200 bg-[#fbfcf8]/95 px-3 py-2.5 backdrop-blur-sm md:sticky md:h-screen md:border-b-0 md:border-r md:bg-[#fbfcf8] md:py-5 md:backdrop-blur-none ${collapsed ? "md:px-2" : "md:px-3.5"}`}>
      <div className={`flex h-9 shrink-0 items-center gap-1 ${collapsed ? "justify-center" : "justify-between"}`}>
      <Link href="/student" className={`flex min-w-0 items-center gap-2.5 text-slate-900 no-underline ${collapsed ? "md:hidden" : "px-2.5"}`} aria-label="Elevra student home">
        <BrandMark compact />
        <span className={`${collapsed ? "md:hidden" : ""} text-base font-semibold tracking-[-.045em]`}>elevra<span className="font-medium text-[#718078]">.ai</span></span>
      </Link>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-600 md:hidden" onClick={onToggleMobile} aria-label={mobileOpen ? "Close student navigation" : "Open student navigation"} aria-expanded={mobileOpen} aria-controls="student-navigation">
        {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
      </Button>
      <Button variant="ghost" size="icon" className="hidden h-9 w-9 shrink-0 text-slate-600 md:inline-flex" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
      </Button>
      </div>
      <p className={`mb-2 mt-7 hidden px-2.5 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400 md:block ${collapsed ? "md:hidden" : ""}`}>Student space</p>
      <nav id="student-navigation" aria-label="Student pages" className={`${mobileOpen ? "grid" : "hidden"} mt-2 grid-cols-5 gap-1 md:mt-0 md:flex md:flex-col md:gap-1.5`}>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/student" ? path === href : path.startsWith(href);
          const mobileLabel = { Home: "Home", "My plan": "Plan", Certifications: "Courses", "Mock interview": "Practice", Inbox: "Inbox" }[label] ?? label;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              onClick={() => { if (mobileOpen) onToggleMobile(); }}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 text-[9px] font-medium no-underline transition-[background-color,color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 md:h-10 md:min-h-0 md:flex-row md:justify-start md:gap-2.5 md:px-2.5 md:py-0 md:text-[11px] ${collapsed ? "md:justify-center md:px-0" : ""} ${active ? "bg-teal-50 text-teal-900 md:shadow-[inset_3px_0_0_#286a62]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-800" : "text-slate-400"}`} aria-hidden="true" />
              <span className="max-w-full truncate md:hidden">{mobileLabel}</span>
              <span className={`hidden max-w-full truncate md:inline ${collapsed ? "md:hidden" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
