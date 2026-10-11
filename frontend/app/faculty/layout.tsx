import type { ReactNode } from "react";
import { FacultyNav } from "@/components/faculty/FacultyNav";

export default function FacultyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <FacultyNav />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
