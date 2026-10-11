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
      <header className="relative mb-6 overflow-hidden rounded-xl border border-[#dce7e1] bg-white px-5 py-5 shadow-sm shadow-slate-900/[0.02] sm:mb-7 sm:px-7 sm:py-6">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#286a62]" />
        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#286a62]">Student space <span className="px-1 text-slate-300">/</span> {title}</p>
        <h1 className="mt-2 text-[clamp(1.55rem,4vw,2rem)] font-semibold tracking-[-.045em] text-[#172824]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </header>
      {children}
    </main>
  );
}

export function StudentLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="rounded-lg border border-[#dce7e1] bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="student-loading-dot" aria-hidden="true" /> Connecting your records to your progress view
        </div>
        <div className="student-progress-track mt-3" aria-hidden="true"><span /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={`rounded-xl border border-slate-200 bg-white ${i === 0 ? "h-36" : "h-28"}`} />)}
      </div>
    </div>
  );
}

export function StudentProgress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e9efeb]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
      <div className="student-value-flow h-full rounded-full bg-[#286a62]" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
