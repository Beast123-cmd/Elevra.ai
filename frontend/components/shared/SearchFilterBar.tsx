"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

interface SearchFilterBarProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  filters: ReactNode;
  activeFilters?: number;
  onClear?: () => void;
  dataTour?: string;
}

/** Shared search row and compact expandable filter panel for dashboard catalogs and tables. */
export function SearchFilterBar({
  label, placeholder, value, onChange, onSearch, filters, activeFilters = 0, onClear, dataTour,
}: SearchFilterBarProps) {
  const panelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch?.();
  }

  return (
    <section aria-label={label} data-tour={dataTour} data-motion-card className="rounded-xl border border-border bg-muted/60 p-3 sm:p-4">
      <form onSubmit={submit} className="flex min-w-0 gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{label}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-5">
          Search
        </button>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>Filter</span>
          {activeFilters > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{activeFilters}</span>}
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </form>

      {filtersOpen && (
        <div id={panelId} className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          {filters}
          {onClear && (activeFilters > 0 || Boolean(value.trim())) && (
            <div className="flex items-end sm:col-span-2 sm:justify-end">
              <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-primary transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-4 w-4" aria-hidden="true" /> Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
