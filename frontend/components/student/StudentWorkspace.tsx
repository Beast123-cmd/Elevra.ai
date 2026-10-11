"use client";

import { useState, type ReactNode } from "react";
import { StudentNav } from "@/components/student/StudentNav";

export function StudentWorkspace({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`min-h-screen bg-slate-50 md:grid md:transition-[grid-template-columns] md:duration-200 md:ease-out ${collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[232px_minmax(0,1fr)]"}`}>
      <StudentNav
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
