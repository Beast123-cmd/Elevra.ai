import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StudentPage({
  title,
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
      <h1 className="sr-only">{title}</h1>
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
