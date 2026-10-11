import type { ReactNode } from "react";

/**
 * Small, dependency-free visuals that turn bare numbers into pictures. Colours come from the theme tokens through
 * class names (CSS works on inline SVG), so light and dark both work. Every visual carries a text equivalent.
 */
export type Tone = "primary" | "red" | "amber" | "green" | "none" | "highlight" | "slate";

const FILL: Record<Tone, string> = {
  primary: "bg-primary", red: "bg-risk-red", amber: "bg-risk-amber", green: "bg-risk-green", none: "bg-risk-none",
  highlight: "bg-highlight", slate: "bg-chart-3",
};
const STROKE: Record<Tone, string> = {
  primary: "stroke-primary", red: "stroke-risk-red", amber: "stroke-risk-amber", green: "stroke-risk-green", none: "stroke-risk-none",
  highlight: "stroke-highlight", slate: "stroke-chart-3",
};
const TEXT: Record<Tone, string> = {
  primary: "text-primary", red: "text-risk-red", amber: "text-risk-amber", green: "text-risk-green", none: "text-risk-none",
  highlight: "text-highlight", slate: "text-chart-3",
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/** Radial progress: a score or a percentage in a ring, with the figure in the middle. */
export function Ring({ value, max = 100, size = 112, stroke = 10, tone = "primary", label, children }: {
  value: number; max?: number; size?: number; stroke?: number; tone?: Tone; label: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp((value / max) * 100);
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="butt"
          strokeDasharray={`${(pct / 100) * c} ${c}`} className={STROKE[tone]} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** A horizontal meter with an optional target line, e.g. attendance against the 75% rule. */
export function Meter({ value, max = 100, target, tone = "primary", label, height = 8, showTarget = true }: {
  value: number | null; max?: number; target?: number; tone?: Tone; label: string; height?: number; showTarget?: boolean;
}) {
  const pct = value == null ? 0 : clamp((value / max) * 100);
  const t = target == null ? null : clamp((target / max) * 100);
  return (
    <div className="relative w-full" role="img" aria-label={label}>
      <div className="w-full overflow-hidden rounded-sm bg-muted" style={{ height }}>
        <div className={`h-full ${value == null ? "" : FILL[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {t != null && showTarget && <span aria-hidden="true" className="absolute -top-1 w-0.5 rounded bg-foreground/70" style={{ left: `calc(${t}% - 1px)`, height: height + 8 }} />}
    </div>
  );
}

export interface Part { label: string; value: number; tone: Tone }

/** Parts of a whole as one bar, with a legend that carries the numbers. */
export function ShareBar({ parts, height = 12, legend = true, label }: { parts: Part[]; height?: number; legend?: boolean; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="space-y-2">
      <div className="flex w-full overflow-hidden rounded-sm bg-muted" style={{ height }} role="img" aria-label={`${label}: ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}`}>
        {parts.map((p) => total > 0 && p.value > 0 && <span key={p.label} className={`${FILL[p.tone]} border-r border-card last:border-r-0`} style={{ width: `${(p.value / total) * 100}%` }} />)}
      </div>
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {parts.map((p) => (
            <li key={p.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[2px] ${FILL[p.tone]}`} />
              <span className="text-muted-foreground">{p.label}</span>
              <span className="tabular font-semibold">{p.value.toLocaleString()}</span>
              {total > 0 && <span className="tabular text-muted-foreground">({Math.round((p.value / total) * 100)}%)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface FunnelStep { label: string; value: number; note?: string; tone?: Tone }

/** A funnel: each step's bar is its share of the first step, so drop-off is visible at a glance. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.value / top) * 100;
        return (
          <li key={s.label} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr_5rem]">
            <span className="text-sm"><span className="tabular mr-2 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{s.label}</span>
            <div className="flex items-center gap-2">
              <div className="h-7 flex-1 overflow-hidden rounded-sm bg-muted">
                <div className={`h-full ${FILL[s.tone ?? "primary"]} ${s.value > 0 && pct < 0.6 ? "min-w-[3px]" : ""}`} style={{ width: `${Math.max(pct, 0)}%` }} />
              </div>
              <span className="tabular w-12 text-right text-xs text-muted-foreground sm:hidden">{Math.round(pct)}%</span>
            </div>
            <span className={`tabular font-serif text-2xl font-semibold leading-none sm:text-right ${TEXT[s.tone ?? "primary"]}`}>{s.value.toLocaleString()}</span>
            {s.note && <span className="text-xs text-muted-foreground sm:col-start-2 sm:col-end-4">{s.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** A figure with a picture: the number, a ring or bar beside it, and a short note. */
export function VisualStat({ label, value, note, visual }: { label: string; value: ReactNode; note?: ReactNode; visual: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm shadow-slate-900/[0.02]">
      <div className="shrink-0">{visual}</div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className="tabular mt-0.5 font-serif text-[26px] font-semibold leading-none tracking-[-0.02em]">{value}</p>
        {note && <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}

/** Tiny percentage ring for use inside a VisualStat. */
export function MiniRing({ pct, tone = "primary", label }: { pct: number; tone?: Tone; label: string }) {
  return <Ring value={pct} size={52} stroke={7} tone={tone} label={label} />;
}
