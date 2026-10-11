"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/student", label: "Home" },
  { href: "/student/improve", label: "Improve" },
  { href: "/student/certifications", label: "Certifications" },
  { href: "/student/interview", label: "Mock interview" },
  { href: "/student/notifications", label: "Notifications" },
];

export function StudentNav() {
  const path = usePathname();
  return (
    <nav aria-label="Student pages" className="border-b bg-white">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
        {LINKS.map((l) => {
          const active = l.href === "/student" ? path === l.href : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
