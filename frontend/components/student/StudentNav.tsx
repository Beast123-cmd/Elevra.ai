"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Bell, BookOpen, House, Mic2 } from "lucide-react";

const LINKS = [
  { href: "/student", label: "Home", icon: House },
  { href: "/student/improve", label: "My plan", icon: BookOpen },
  { href: "/student/certifications", label: "Certifications", icon: Award },
  { href: "/student/interview", label: "Mock interview", icon: Mic2 },
  { href: "/student/notifications", label: "Inbox", icon: Bell },
];

export function StudentNav() {
  const path = usePathname();

  return (
    <aside className="flex min-w-0 flex-col border-b border-slate-200 bg-white px-3 py-3 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r md:px-3.5 md:py-5">
      <Link href="/student" className="flex h-9 shrink-0 items-center gap-2.5 px-2.5 text-slate-900 no-underline" aria-label="Elevra student home">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-800 text-sm font-semibold text-white">e</span>
        <span className="text-base font-bold tracking-tight">elevra</span>
      </Link>
      <p className="mb-2 mt-7 hidden px-2.5 text-[9px] font-semibold uppercase tracking-[.1em] text-slate-400 md:block">Student space</p>
      <nav aria-label="Student pages" className="mt-2 flex gap-1 overflow-x-auto md:mt-0 md:grid md:gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/student" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[11px] font-medium no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 md:w-full ${active ? "bg-teal-50 text-teal-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-800" : "text-slate-400"}`} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-slate-100 px-2.5 pt-4 md:block">
        <p className="text-[10px] font-medium text-slate-700">Your student space</p>
        <p className="mt-0.5 text-[9px] text-slate-500">Your records and next steps</p>
      </div>
    </aside>
  );
}
