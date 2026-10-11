import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StudentPage({
  title,
  description,
  children,
  width = "wide",
}: {
  title: string;
  description: string;
  children: ReactNode;
  width?: "wide" | "reading";
}) {
  return (
    <main className={`mx-auto w-full ${width === "reading" ? "max-w-4xl" : "max-w-[1120px]"} px-4 py-6 sm:px-6 sm:py-8 lg:px-10`}>
      <header className="mb-6 border-b border-slate-200/80 pb-5 sm:mb-7 sm:pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#286a62]">Your student space</p>
        <h1 className="mt-1 text-[clamp(1.45rem,4vw,1.85rem)] font-semibold tracking-[-.04em] text-[#172824]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </header>
      {children}
    </main>
  );
}

export function StudentLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="student-loading-dot" aria-hidden="true" /> Loading your student records
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`rounded-xl border border-slate-200 bg-white ${i === 0 ? "h-36" : "h-28"}`} />)}
      </div>
    </div>
  );
}
