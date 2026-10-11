"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOutAndLeave } from "@/components/shared/session";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/users", "Users"],
  ["/admin/workload", "Response & workload"],
  ["/admin/interventions", "Interventions"],
  ["/admin/notifications", "Notifications"],
  ["/admin/evidence", "Evidence"],
  ["/admin/chat", "Ask your data"],
  ["/faculty", "Action Queue"],
  ["/faculty/attendance", "Attendance"],
  ["/insights/data-health", "Data Health"],
  ["/insights/segments", "Segments"],
  ["/insights/method", "Method & Trust"],
] as const;

export function AdminNav() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <span className="font-bold text-primary">
          Elevra.ai <span className="font-normal text-muted-foreground">· Admin</span>
        </span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {LINKS.map(([href, label]) => {
            const active = href === "/admin" ? path === "/admin" : href === "/faculty" ? path === "/faculty" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={signOutAndLeave}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
