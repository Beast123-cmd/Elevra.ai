import type { ReactNode } from "react";
import type { Tier } from "@/lib/types";

/**
 * Page building blocks for the "campus annual report" look: serif titles, hairline panels, figures that line up.
 * Every colour comes from the tokens in app/globals.css, so light and dark both work without overrides.
 */
export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>}
        <h1 className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, actions, children, className = "", padded = true, id }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; padded?: boolean; id?: string;
}) {
  return (
    <section id={id} className={`min-w-0 rounded-lg border border-border bg-card ${className}`}>
      {(title || actions) && (
        <div className={`flex flex-wrap items-start justify-between gap-3 ${padded ? "px-5 pt-4" : "px-5 py-4"}`}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? "p-5 pt-3" : ""}>{children}</div>
    </section>
  );
}

/** A headline figure. The number is set in the serif face, like a figure in a printed report. */
export function Stat({ label, value, note, tone = "default" }: { label: string; value: ReactNode; note?: ReactNode; tone?: "default" | "alert" | "good" }) {
  const color = tone === "alert" ? "text-risk-red" : tone === "good" ? "text-risk-green" : "text-foreground";
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className={`tabular mt-1 font-serif text-[28px] font-semibold leading-none tracking-[-0.02em] ${color}`}>{value}</p>
      {note && <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}

const TIER_CLASS: Record<Tier, string> = {
  Red: "bg-risk-red-bg text-risk-red",
  Amber: "bg-risk-amber-bg text-risk-amber",
  Green: "bg-risk-green-bg text-risk-green",
  "Not assessed": "bg-risk-none-bg text-risk-none",
};
const TIER_WORDS: Record<Tier, string> = { Red: "Red", Amber: "Amber", Green: "Green", "Not assessed": "Not yet assessed" };

/** Risk shown with colour and words, never colour alone. A small square marker reads like a report legend. */
export function RiskTag({ level, prefix }: { level: Tier; prefix?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${TIER_CLASS[level]}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px] bg-current" />
      {prefix ? `${prefix} · ` : ""}{TIER_WORDS[level]}
    </span>
  );
}

const BAND_CLASS: Record<string, string> = {
  Thriving: "text-risk-green border-risk-green/40",
  "On Track": "text-primary border-primary/40",
  "Needs Attention": "text-risk-amber border-risk-amber/40",
  Critical: "text-risk-red border-risk-red/40",
};

export function BandTag({ band }: { band: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${BAND_CLASS[band] ?? "border-border text-muted-foreground"}`}>{band}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
