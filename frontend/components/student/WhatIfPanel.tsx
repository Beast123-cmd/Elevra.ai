"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { BAND_COLOR, TIER_STYLE, fmt } from "@/lib/format";
import type { Profile, WhatIfResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

interface Control {
  key: "attendance_pct" | "internal_pct" | "submit_rate" | "coding" | "aptitude" | "mock";
  label: string;
  min: number; max: number; step: number;
  unit?: string;
  /** Slider units per API unit (submit_rate is a 0-1 fraction in the API but shown as a percentage). */
  scale?: number;
}

const CONTROLS: Control[] = [
  { key: "attendance_pct", label: "Attendance", min: 0, max: 100, step: 1, unit: "%" },
  { key: "internal_pct", label: "Internal marks", min: 0, max: 100, step: 1, unit: "%" },
  { key: "submit_rate", label: "Assignments submitted", min: 0, max: 100, step: 1, unit: "%", scale: 100 },
  { key: "coding", label: "Coding score", min: 0, max: 100, step: 1 },
  { key: "aptitude", label: "Aptitude score", min: 0, max: 100, step: 1 },
  { key: "mock", label: "Mock interview (out of 5)", min: 1, max: 5, step: 0.5 },
];

const DEBOUNCE_MS = 300;

type Values = Partial<Record<Control["key"], number>>;
type Sim = { status: "idle" } | { status: "loading" } | { status: "offline" } | { status: "ready"; result: WhatIfResponse };

export function WhatIfPanel({ profile }: { profile: Profile }) {
  const mock = useSearchParams().get("mock") === "1";
  const [changed, setChanged] = useState<Values>({}); // in slider units; only controls the student has moved
  const [sim, setSim] = useState<Sim>({ status: "idle" });
  const latest = useRef(0);

  const current = (c: Control): number | null => {
    const v = profile.metrics[c.key];
    return v === null || v === undefined ? null : v * (c.scale ?? 1);
  };
  const shown = (c: Control) => changed[c.key] ?? current(c) ?? (c.min + c.max) / 2;
  const hasChanges = Object.keys(changed).length > 0;

  useEffect(() => {
    if (!hasChanges) { setSim({ status: "idle" }); return; }
    const id = ++latest.current;
    setSim((s) => (s.status === "ready" ? s : { status: "loading" }));
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
  }, [changed, hasChanges, mock, profile]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What if…?</CardTitle>
        <CardDescription>
          Move a slider to see how that change would affect your Success Score. This is a simulation only. Nothing is saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          {CONTROLS.map((c) => {
            const cur = current(c);
            const value = shown(c);
            return (
              <div key={c.key}>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <label htmlFor={`wi-${c.key}`}>{c.label}</label>
                  <span className="tabular-nums">
                    <span className="font-medium">{fmt(value, c.step < 1 ? 1 : 0, c.unit ?? "")}</span>
                    <span className="ml-2 text-xs text-slate-400">{cur === null ? "not assessed yet" : `now ${fmt(cur, c.step < 1 ? 1 : 0, c.unit ?? "")}`}</span>
                  </span>
                </div>
                <Slider
                  id={`wi-${c.key}`} min={c.min} max={c.max} step={c.step} value={[value]}
                  onValueChange={([v]) => setChanged((prev) => ({ ...prev, [c.key]: v }))}
                  aria-label={c.label}
                />
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={() => setChanged({})} disabled={!hasChanges}>Reset to my current values</Button>
        </div>

        <div aria-live="polite" className="rounded-lg border bg-slate-50 p-5">
          {sim.status === "idle" && <p className="text-sm text-slate-500">Move a slider to see your new score.</p>}
          {sim.status === "loading" && <p className="text-sm text-slate-500">Working it out…</p>}
          {sim.status === "offline" && (
            <p role="alert" className="text-sm text-slate-700">
              <span className="font-medium">Simulator offline.</span> We couldn&apos;t reach the scoring service. The rest of your dashboard still works. Try again in a minute.
            </p>
          )}
          {sim.status === "ready" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">New Success Score</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: BAND_COLOR[sim.result.band] }}>
                  {fmt(sim.result.score, 1)}
                  <span className={`ml-3 text-lg font-semibold ${sim.result.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {sim.result.delta >= 0 ? "+" : ""}{sim.result.delta.toFixed(1)}
                  </span>
                </p>
                <p className="text-sm" style={{ color: BAND_COLOR[sim.result.band] }}>{sim.result.band} · now {fmt(profile.score, 1)} ({profile.band})</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 ring-1 ${TIER_STYLE[sim.result.academic_risk.level]}`}>Academic: {sim.result.academic_risk.level}</span>
                <span className={`rounded-full px-2.5 py-0.5 ring-1 ${TIER_STYLE[sim.result.placement_risk.level]}`}>Placement: {sim.result.placement_risk.level}</span>
              </div>
            </div>
          )}
        </div>
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
