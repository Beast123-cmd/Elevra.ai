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
    <main className={`mx-auto w-full ${width === "reading" ? "max-w-4xl" : "max-w-[1120px]"} px-4 py-4 sm:px-6 sm:py-5 lg:px-10`}>
      <h1 className="sr-only">{title}</h1>
      {children}
    </main>
  );
}

export function StudentLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading student data" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-4 w-2/5 bg-muted" />
            <Skeleton className="h-7 w-14 rounded-full bg-muted" />
          </div>
          <Skeleton className="mt-5 h-7 w-3/5 bg-muted" />
          <Skeleton className="mt-3 h-3 w-full bg-muted" />
          <Skeleton className="mt-2 h-3 w-4/5 bg-muted" />
          <Skeleton className="mt-5 h-9 w-24 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function StudentProgress({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
      <div className="student-value-flow h-full rounded-full bg-primary" style={{ width: `${safeValue}%` }} />
    </div>
  );
}
