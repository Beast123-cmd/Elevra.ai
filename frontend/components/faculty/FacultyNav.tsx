"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getIdentity, signOutAndLeave } from "@/components/shared/session";

const LINKS = [
  ["/faculty", "Action Queue"],
  ["/faculty/attendance", "Attendance"],
  ["/insights/segments", "Segments"],
  ["/insights/data-health", "Data Health"],
  ["/insights/method", "Method & Trust"],
  ["/demo", "Guided demo"],
] as const;

export function FacultyNav() {
  const path = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    getIdentity().then((id) => setIsAdmin(id?.role === "admin"));
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <span className="font-bold text-primary">
          Elevra.ai <span className="font-normal text-muted-foreground">· {isAdmin ? "Admin view of faculty tools" : "Faculty"}</span>
        </span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {isAdmin && (
            <Link href="/admin" className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted">
              ← Admin
            </Link>
          )}
          {LINKS.map(([href, label]) => {
            const active = href === "/faculty" ? path === "/faculty" || path.startsWith("/faculty/student") : path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}>
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
