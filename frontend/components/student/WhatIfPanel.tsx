"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { fmt } from "@/lib/format";
import { usePalette } from "@/components/shared/palette";
import { TIER_CLASS } from "./tierClass";
import { PILLARS, type Pillar, type Profile, type WhatIfResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { StudentProgress } from "./StudentPage";
import { PILLAR_LABEL } from "./playbook";

interface Control {
  key: "attendance_pct" | "internal_pct" | "submit_rate" | "coding" | "aptitude" | "mock";
  label: string;
  min: number; max: number; step: number;
  unit?: string;
  /** Slider units per API unit (submit_rate is a 0-1 fraction in the API but shown as a percentage). */
  scale?: number;
  group: "Study habits" | "Career preparation";
}

const CONTROLS: Control[] = [
  { key: "attendance_pct", label: "Attendance", min: 0, max: 100, step: 1, unit: "%", group: "Study habits" },
  { key: "internal_pct", label: "Internal marks", min: 0, max: 100, step: 1, unit: "%", group: "Study habits" },
  { key: "submit_rate", label: "Assignments submitted", min: 0, max: 100, step: 1, unit: "%", scale: 100, group: "Study habits" },
  { key: "coding", label: "Coding score", min: 0, max: 100, step: 1, group: "Career preparation" },
  { key: "aptitude", label: "Aptitude score", min: 0, max: 100, step: 1, group: "Career preparation" },
  { key: "mock", label: "Mock interview", min: 1, max: 5, step: 0.5, unit: " / 5", group: "Career preparation" },
];

const DEBOUNCE_MS = 300;

type Values = Partial<Record<Control["key"], number>>;
type Sim = { status: "idle" } | { status: "loading"; previous?: WhatIfResponse } | { status: "offline" } | { status: "ready"; result: WhatIfResponse };

const CONTROL_PILLARS: Record<Control["key"], Pillar> = {
  attendance_pct: "attendance",
  internal_pct: "academic",
  submit_rate: "lms",
  coding: "placement",
  aptitude: "placement",
  mock: "placement",
};

export function WhatIfPanel({ profile }: { profile: Profile }) {
  const pal = usePalette();
  const mock = useSearchParams().get("mock") === "1";
  const [changed, setChanged] = useState<Values>({}); // in slider units; only controls the student has moved
  const [sim, setSim] = useState<Sim>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);

  const current = (c: Control): number | null => {
    const v = profile.metrics[c.key];
    return v === null || v === undefined ? null : v * (c.scale ?? 1);
  };
  const shown = (c: Control) => changed[c.key] ?? current(c) ?? (c.min + c.max) / 2;
  const hasChanges = Object.keys(changed).length > 0;

  useEffect(() => {
    if (!hasChanges) {
      latest.current += 1;
      setSim({ status: "idle" });
      return;
    }
    const id = ++latest.current;
    setSim((previous) => ({
      status: "loading",
      ...(previous.status === "ready" ? { previous: previous.result } : previous.status === "loading" && previous.previous ? { previous: previous.previous } : {}),
    }));
    const timer = setTimeout(async () => {
      const overrides = Object.fromEntries(
        CONTROLS.filter((c) => changed[c.key] !== undefined).map((c) => [c.key, (changed[c.key] as number) / (c.scale ?? 1)]),
      );
      try {
        const result = mock
          ? mockResult(profile, changed)
          : await api<WhatIfResponse>("/whatif", { student_id: profile.student_id, overrides });
        if (id === latest.current) setSim({ status: "ready", result });
      } catch {
        if (id === latest.current) setSim({ status: "offline" });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [changed, hasChanges, mock, profile, attempt]);

  const formatControl = (c: Control, value: number) => fmt(value, c.step < 1 ? 1 : 0, c.unit ?? "");
  const changedCount = Object.keys(changed).length;
  const displayedResult = sim.status === "ready" ? sim.result : sim.status === "loading" ? sim.previous : undefined;
  const changedControls = CONTROLS.filter((control) => changed[control.key] !== undefined);
  const impactPillars: Pillar[] = PILLARS.filter((pillar) =>
    changedControls.some((control) => CONTROL_PILLARS[control.key] === pillar),
  );

  return (
    <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.025]">
      <CardHeader className="border-b border-border bg-muted px-5 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-primary">Explore a scenario</p>
        <CardTitle className="mt-1 text-xl tracking-[-.03em] text-foreground">See how a change could affect your score</CardTitle>
        <CardDescription className="max-w-2xl leading-5">Adjust the values below to explore a possible outcome. This is a simulation only; it does not change your records.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 items-start gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
        <section className="min-w-0" aria-labelledby="scenario-controls-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 id="scenario-controls-heading" className="text-sm font-semibold text-foreground">Choose what to adjust</h3><p className="mt-0.5 text-xs text-muted-foreground">{changedCount ? `${changedCount} ${changedCount === 1 ? "value" : "values"} changed` : "Drag a slider or focus it and use the arrow keys."}</p></div>
            <Button variant="ghost" size="sm" onClick={() => setChanged({})} disabled={!hasChanges} className="h-8 px-2 text-xs text-primary">Reset values</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["Study habits", "Career preparation"] as const).map((group) => (
              <fieldset key={group} className="min-w-0 rounded-lg border border-border bg-muted p-3.5 sm:p-4">
                <legend className="px-1 text-xs font-semibold text-foreground">{group}</legend>
                <div className="space-y-5">
                  {CONTROLS.filter((c) => c.group === group).map((c) => {
                    const cur = current(c);
                    const value = shown(c);
                    return (
                      <div key={c.key} className="min-w-0">
                        <div className="mb-2 flex items-start justify-between gap-2 text-xs">
                          <label htmlFor={`wi-${c.key}`} className="font-medium leading-5 text-foreground">{c.label}</label>
                          <span className="shrink-0 text-right tabular-nums"><span className="font-semibold text-foreground">{formatControl(c, value)}</span><span className="block text-[10px] text-muted-foreground">{cur === null ? "no current data" : `current ${formatControl(c, cur)}`}</span></span>
                        </div>
                        <Slider className="what-if-slider cursor-pointer py-1" id={`wi-${c.key}`} min={c.min} max={c.max} step={c.step} value={[value]} onValueChange={([v]) => setChanged((prev) => ({ ...prev, [c.key]: v }))} aria-label={c.label} aria-valuetext={formatControl(c, value)} />
                        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-muted-foreground" aria-hidden="true"><span>{formatControl(c, c.min)}</span><span>{formatControl(c, c.max)}</span></div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </section>

        <section className="min-w-0 self-start rounded-xl border border-border bg-muted p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-primary">Score comparison</p><h3 className="mt-1 text-sm font-semibold text-foreground">Your scenario</h3></div>{sim.status === "ready" && <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-border">Estimate</span>}</div>
          {sim.status === "idle" && (
            <div className="mt-5 space-y-4">
              <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Current Success Score</p><p className="mt-1 text-4xl font-semibold tracking-[-.05em] tabular-nums text-foreground">{fmt(profile.score, 1)}<span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span></p></div><span className="mb-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">{profile.band}</span></div>
              <StudentProgress value={profile.score} label="Current success score" />
              <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">Move a value to compare a simulated score with your current score.</p>
            </div>
          )}
          {sim.status === "loading" && <div className="mt-5" role="status"><p className="flex items-center gap-2 text-sm font-medium text-foreground"><span className="student-loading-dot" aria-hidden="true" /> Updating the estimate for your latest values</p><div className="student-progress-track mt-3" aria-hidden="true"><span /></div><p className="mt-3 text-xs text-muted-foreground">Your saved student data is not being changed.</p></div>}
          {changedControls.length > 0 && (
            <section aria-label="Scenario inputs compared with current records" className="mt-5 space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-end justify-between gap-2"><div><h4 className="text-xs font-semibold text-foreground">Values you’re exploring</h4><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Bars compare each value with its own scale; they are not score predictions.</p></div><div className="flex gap-3 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted" aria-hidden="true" />Current</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />Scenario</span></div></div>
              <div className="space-y-3">
                {changedControls.map((control) => {
                  const baseline = current(control);
                  const scenario = shown(control);
                  const toWidth = (value: number) => `${Math.max(0, Math.min(100, ((value - control.min) / (control.max - control.min)) * 100))}%`;
                  return (
                    <div key={control.key}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                        <span className="font-medium text-foreground">{control.label}</span>
                        <span className="tabular-nums text-muted-foreground">{baseline === null ? "No current record" : formatControl(control, baseline)} <span className="px-1 text-muted-foreground">→</span> <strong className="text-primary">{formatControl(control, scenario)}</strong></span>
                      </div>
                      <div className="space-y-1.5">
                        {baseline !== null && <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: toWidth(baseline) }} /></div>}
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: toWidth(scenario) }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {displayedResult && (
                <div className="border-t border-border pt-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-semibold text-foreground">Score areas affected</h4>{sim.status === "loading" && <span className="text-[10px] font-medium text-risk-amber">Showing previous estimate while updating</span>}</div>
                  <div className="space-y-3">
                    {impactPillars.map((pillar) => {
                      const before = profile.pillars[pillar];
                      const after = displayedResult.pillars[pillar];
                      if (before === null || after === null) return <p key={pillar} className="text-[11px] text-muted-foreground">{PILLAR_LABEL[pillar]} cannot be compared because it is not assessed.</p>;
                      const change = after - before;
                      return (
                        <div key={pillar}>
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px]"><span className="font-medium text-foreground">{PILLAR_LABEL[pillar]}</span><span className={`font-semibold tabular-nums ${change > 0 ? "text-risk-green" : change < 0 ? "text-risk-red" : "text-muted-foreground"}`}>{fmt(before, 0)} <span className="px-0.5 text-muted-foreground">→</span> {fmt(after, 0)}{change === 0 ? " · no change" : ` · ${change > 0 ? "+" : ""}${fmt(change, 1)} pts`}</span></div>
                          <div className="relative h-2 overflow-hidden rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-muted/80" style={{ width: `${Math.max(0, Math.min(100, before))}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(100, after))}%` }} /></div>
                          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>Current</span><span>Scenario</span></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
          {sim.status === "offline" && (
            <div className="mt-5 space-y-4" role="alert">
              <div className="flex items-end justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
                <div><p className="text-[10px] font-medium text-muted-foreground">Current Success Score</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{fmt(profile.score, 1)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></p></div>
                <span className="mb-0.5 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{profile.band}</span>
              </div>
              <div>
                <p className="text-sm leading-5 text-foreground"><span className="font-semibold">Estimate unavailable.</span> We couldn&apos;t reach the scoring service. Your saved records are unchanged.</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)} disabled={!hasChanges} className="mt-3 border-border font-semibold text-primary hover:bg-muted hover:text-primary">Try again</Button>
              </div>
            </div>
          )}
          {displayedResult && (
            <div className="mt-5 space-y-4">
              <div aria-live="polite" aria-atomic="true" className="grid grid-cols-[1fr_auto_1fr] items-end gap-2"><div><p className="text-[10px] text-muted-foreground">Current</p><p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground">{fmt(profile.score, 1)}</p></div><span className="pb-1 text-muted-foreground" aria-hidden="true">→</span><div className="text-right"><p className="text-[10px] text-muted-foreground">{sim.status === "loading" ? "Previous estimate" : "Estimated"}</p><p className="mt-1 text-3xl font-semibold tracking-[-.04em] tabular-nums transition-colors duration-300" style={{ color: pal.band[displayedResult.band] }}>{fmt(displayedResult.score, 1)}</p></div></div>
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Estimated change</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${displayedResult.delta >= 0 ? "bg-risk-green-bg text-risk-green" : "bg-risk-red-bg text-risk-red"}`}>{displayedResult.delta >= 0 ? "+" : ""}{displayedResult.delta.toFixed(1)}</span></div>
              <StudentProgress value={displayedResult.score} label="Estimated success score" />
              <div className="flex flex-wrap gap-2 border-t border-border pt-3 text-[10px]"><span className={`rounded-full px-2 py-1 ${TIER_CLASS[displayedResult.academic_risk.level]}`}>Academic · {displayedResult.academic_risk.level}</span><span className={`rounded-full px-2 py-1 ${TIER_CLASS[displayedResult.placement_risk.level]}`}>Career · {displayedResult.placement_risk.level}</span></div>
              <p className="text-[10px] leading-4 text-muted-foreground">Estimate based on the values you changed. It is not a prediction or a saved result.</p>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

// Rough stand-in used only for ?mock=1 previews; the real number always comes from /whatif.
function mockResult(p: Profile, changed: Values): WhatIfResponse {
  const delta = Object.entries(changed).reduce((sum, [k, v]) => {
    const c = CONTROLS.find((x) => x.key === k)!;
    const cur = p.metrics[k] === null || p.metrics[k] === undefined ? (c.min + c.max) / 2 : (p.metrics[k] as number) * (c.scale ?? 1);
    return sum + (((v as number) - cur) / (c.max - c.min)) * 8;
  }, 0);
  const score = Math.max(0, Math.min(100, p.score + delta));
  const band = score >= 75 ? "Thriving" : score >= 60 ? "On Track" : score >= 45 ? "Needs Attention" : "Critical";
  return { score: Math.round(score * 10) / 10, band, delta: Math.round((score - p.score) * 10) / 10, pillars: p.pillars,
    academic_risk: p.academic_risk, placement_risk: p.placement_risk };
}
