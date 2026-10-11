"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { BAND_COLOR, TIER_STYLE, fmt } from "@/lib/format";
import type { Profile, WhatIfResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { StudentProgress } from "./StudentPage";

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
type Sim = { status: "idle" } | { status: "loading" } | { status: "offline" } | { status: "ready"; result: WhatIfResponse };

export function WhatIfPanel({ profile }: { profile: Profile }) {
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
    setSim({ status: "loading" });
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

  return (
    <Card className="overflow-hidden rounded-xl border-[#d5e2db] bg-white shadow-sm shadow-slate-900/[0.025]">
      <CardHeader className="border-b border-[#dce7e1] bg-[#edf4f0] px-5 py-5 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">Explore a scenario</p>
        <CardTitle className="mt-1 text-xl tracking-[-.03em] text-[#172824]">See how a change could affect your score</CardTitle>
        <CardDescription className="max-w-2xl leading-5">Adjust the values below to explore a possible outcome. This is a simulation only; it does not change your records.</CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 items-start gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
        <section className="min-w-0" aria-labelledby="scenario-controls-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h3 id="scenario-controls-heading" className="text-sm font-semibold text-[#172824]">Choose what to adjust</h3><p className="mt-0.5 text-xs text-slate-500">{changedCount ? `${changedCount} ${changedCount === 1 ? "value" : "values"} changed` : "Drag a slider or focus it and use the arrow keys."}</p></div>
            <Button variant="ghost" size="sm" onClick={() => setChanged({})} disabled={!hasChanges} className="h-8 px-2 text-xs text-[#1d6158]">Reset values</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["Study habits", "Career preparation"] as const).map((group) => (
              <fieldset key={group} className="min-w-0 rounded-lg border border-[#dce7e1] bg-[#f3f7f4] p-3.5 sm:p-4">
                <legend className="px-1 text-xs font-semibold text-slate-700">{group}</legend>
                <div className="space-y-5">
                  {CONTROLS.filter((c) => c.group === group).map((c) => {
                    const cur = current(c);
                    const value = shown(c);
                    return (
                      <div key={c.key} className="min-w-0">
                        <div className="mb-2 flex items-start justify-between gap-2 text-xs">
                          <label htmlFor={`wi-${c.key}`} className="font-medium leading-5 text-slate-700">{c.label}</label>
                          <span className="shrink-0 text-right tabular-nums"><span className="font-semibold text-[#172824]">{formatControl(c, value)}</span><span className="block text-[10px] text-slate-400">{cur === null ? "no current data" : `current ${formatControl(c, cur)}`}</span></span>
                        </div>
                        <Slider className="what-if-slider cursor-pointer py-1" id={`wi-${c.key}`} min={c.min} max={c.max} step={c.step} value={[value]} onValueChange={([v]) => setChanged((prev) => ({ ...prev, [c.key]: v }))} aria-label={c.label} aria-valuetext={formatControl(c, value)} />
                        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-slate-400" aria-hidden="true"><span>{formatControl(c, c.min)}</span><span>{formatControl(c, c.max)}</span></div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </section>

        <section aria-live="polite" aria-atomic="true" className="min-w-0 self-start rounded-xl border border-[#dce7e1] bg-[#f6f9f7] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#286a62]">Score comparison</p><h3 className="mt-1 text-sm font-semibold text-[#172824]">Your scenario</h3></div>{sim.status === "ready" && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200">Estimate</span>}</div>
          {sim.status === "idle" && (
            <div className="mt-5 space-y-4">
              <div className="flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">Current Success Score</p><p className="mt-1 text-4xl font-semibold tracking-[-.05em] tabular-nums text-[#172824]">{fmt(profile.score, 1)}<span className="ml-1 text-base font-normal text-slate-400">/ 100</span></p></div><span className="mb-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{profile.band}</span></div>
              <StudentProgress value={profile.score} label="Current success score" />
              <p className="border-t border-[#dce7e1] pt-3 text-xs leading-5 text-slate-500">Move a value to compare a simulated score with your current score.</p>
            </div>
          )}
          {sim.status === "loading" && <div className="mt-5" role="status"><p className="flex items-center gap-2 text-sm font-medium text-slate-700"><span className="student-loading-dot" aria-hidden="true" /> Updating your estimate</p><div className="student-progress-track mt-3" aria-hidden="true"><span /></div><p className="mt-3 text-xs text-slate-500">Your saved student data is not being changed.</p></div>}
          {sim.status === "offline" && (
            <div className="mt-5 space-y-4" role="alert">
              <div className="flex items-end justify-between gap-3 rounded-lg border border-[#dce7e1] bg-white px-3.5 py-3">
                <div><p className="text-[10px] font-medium text-slate-500">Current Success Score</p><p className="mt-1 text-2xl font-semibold tabular-nums text-[#172824]">{fmt(profile.score, 1)}<span className="ml-1 text-xs font-normal text-slate-400">/ 100</span></p></div>
                <span className="mb-0.5 rounded-full bg-[#f6f8f6] px-2 py-1 text-[10px] font-medium text-slate-600">{profile.band}</span>
              </div>
              <div>
                <p className="text-sm leading-5 text-slate-700"><span className="font-semibold">Estimate unavailable.</span> We couldn&apos;t reach the scoring service. Your saved records are unchanged.</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)} disabled={!hasChanges} className="mt-3 border-[#bfd4ca] font-semibold text-[#15564e] hover:bg-[#edf5f1] hover:text-[#10463f]">Try again</Button>
              </div>
            </div>
          )}
          {sim.status === "ready" && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2"><div><p className="text-[10px] text-slate-500">Current</p><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-500">{fmt(profile.score, 1)}</p></div><span className="pb-1 text-slate-400" aria-hidden="true">→</span><div className="text-right"><p className="text-[10px] text-slate-500">Estimated</p><p className="mt-1 text-3xl font-semibold tracking-[-.04em] tabular-nums" style={{ color: BAND_COLOR[sim.result.band] }}>{fmt(sim.result.score, 1)}</p></div></div>
              <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Estimated change</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${sim.result.delta >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{sim.result.delta >= 0 ? "+" : ""}{sim.result.delta.toFixed(1)}</span></div>
              <StudentProgress value={sim.result.score} label="Estimated success score" />
              <div className="flex flex-wrap gap-2 border-t border-[#dce7e1] pt-3 text-[10px]"><span className={`rounded-full px-2 py-1 ring-1 ${TIER_STYLE[sim.result.academic_risk.level]}`}>Academic · {sim.result.academic_risk.level}</span><span className={`rounded-full px-2 py-1 ring-1 ${TIER_STYLE[sim.result.placement_risk.level]}`}>Career · {sim.result.placement_risk.level}</span></div>
              <p className="text-[10px] leading-4 text-slate-500">Estimate based on the values you changed. It is not a prediction or a saved result.</p>
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
