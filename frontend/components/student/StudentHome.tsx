"use client";

import { BAND_COLOR, SEGMENT_COLOR, TIER_STYLE, fmt } from "@/lib/format";
import { PILLARS, type Profile, type Risk } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PILLAR_LABEL } from "./playbook";
import { useStudentProfile } from "./useStudentProfile";
import { WhatIfPanel } from "./WhatIfPanel";

function RiskCard({ title, risk }: { title: string; risk: Risk }) {
  const notAssessed = risk.level === "Not assessed";
  const message = notAssessed ? "Not yet assessed" : risk.level === "Green" ? "No flags right now" : "Needs a check-in";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${TIER_STYLE[risk.level]}`}>{risk.level}</span>
        </div>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent>
        {risk.drivers.length === 0 ? (
          <p className="text-sm text-slate-500">{notAssessed ? "Placement data appears here once you have completed an assessment." : "Nothing is pulling this down."}</p>
        ) : (
          <ul className="space-y-2">
            {risk.drivers.map((d) => (
              <li key={d.label} className="flex items-start justify-between gap-3 text-sm">
                <span>{d.label}</span>
                <span className="shrink-0 font-medium tabular-nums">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Dashboard({ p }: { p: Profile }) {
  const m = p.metrics;
  const top = [...p.contributions].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="text-sm text-slate-500">{p.department} · Year {p.year} · Batch {p.batch}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEGMENT_COLOR[p.segment] ?? "#64748b" }} />
              {p.segment}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-5xl font-bold tabular-nums" style={{ color: BAND_COLOR[p.band] }}>{fmt(p.score, 1)}</p>
            <p className="mt-1 font-medium" style={{ color: BAND_COLOR[p.band] }}>{p.band}</p>
            <p className="text-xs text-slate-500">
              Confidence {p.confidence}%{p.missing.length > 0 && ` · no data for ${p.missing.map((k) => PILLAR_LABEL[k].toLowerCase()).join(", ")}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <RiskCard title="Academic outlook" risk={p.academic_risk} />
        <RiskCard title="Placement outlook" risk={p.placement_risk} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your score, area by area</CardTitle>
            <CardDescription>Each area is out of 100</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PILLARS.map((k) => {
              const v = p.pillars[k];
              return (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{PILLAR_LABEL[k]}</span>
                    <span className="tabular-nums text-slate-500">{v === null ? "No data yet" : v.toFixed(0)}</span>
                  </div>
                  <Progress value={v ?? 0} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What&apos;s moving your score</CardTitle>
              <CardDescription>Compared with the average student</CardDescription>
            </CardHeader>
            <CardContent>
              {top.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing to compare yet.</p>
              ) : (
                <ul className="space-y-2">
                  {top.map((c) => (
                    <li key={c.pillar} className="flex justify-between text-sm">
                      <span>{PILLAR_LABEL[c.pillar]}</span>
                      <span className={`font-medium tabular-nums ${c.points >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {c.points >= 0 ? "+" : ""}{c.points.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>At a glance</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Attendance" value={fmt(m.attendance_pct, 0, "%")} />
              <Fact label="CGPA" value={fmt(m.cgpa, 2)} />
              <Fact label="Backlogs" value={fmt(m.backlogs, 0)} />
              <Fact label="Certifications" value={fmt(m.certifications, 0)} />
            </CardContent>
          </Card>

          {p.actions.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Suggested next steps</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {p.actions.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <WhatIfPanel profile={p} />
    </div>
  );
}

export function StudentHome() {
  const { state, mock } = useStudentProfile();

  if (state.status === "loading") {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-36" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load your dashboard</CardTitle>
          <CardDescription>{state.message}. Try signing in again.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (state.status === "empty") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No score yet</CardTitle>
          <CardDescription>Your score hasn&apos;t been calculated yet. Check back after the next data refresh.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <>
      {mock && <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Showing sample data (?mock=1).</p>}
      <Dashboard p={state.profile} />
    </>
  );
}
