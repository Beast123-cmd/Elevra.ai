"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  label?: string;
}

/** Compact pagination used by dashboard catalogs and tables. */
export function Pagination({ page, totalItems, pageSize = 25, onPageChange, label = "Results pages" }: PaginationProps) {
  const navRef = useRef<HTMLElement>(null);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(page, 1), totalPages);
  const first = (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, totalItems);
  const button = "inline-flex h-9 items-center justify-center gap-1 rounded-md px-2.5 text-sm font-medium text-foreground transition-[background-color,color,transform] duration-200 hover:bg-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:text-muted-foreground/45 disabled:hover:bg-transparent motion-reduce:transition-none";
  const go = (next: number) => {
    onPageChange(next);
    requestAnimationFrame(() => navRef.current?.closest("[data-pagination-root]")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <nav ref={navRef} aria-label={label} className="mt-5 flex justify-center">
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm shadow-slate-900/[0.04]">
        <p className="px-2 text-sm tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{first}–{last}</span> of {totalItems}
        </p>
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <button type="button" className={button} disabled={current === 1} onClick={() => go(current - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Previous</span>
        </button>
        <span aria-live="polite" className="min-w-[72px] rounded-md bg-muted px-2.5 py-2 text-center text-sm font-medium tabular-nums text-foreground">
          {current} <span className="text-muted-foreground">/ {totalPages}</span>
        </span>
        <button type="button" className={button} disabled={current === totalPages} onClick={() => go(current + 1)}>
          <span className="hidden sm:inline">Next</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
