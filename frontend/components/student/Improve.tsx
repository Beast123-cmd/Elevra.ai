"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt, TIER_STYLE } from "@/lib/format";
import { PILLARS } from "@/lib/types";
import { PILLAR_LABEL, PLAYBOOK } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";
import { WhatIfPanel } from "./WhatIfPanel";
import { StudentProgress } from "./StudentPage";
import { StudentReveal } from "./StudentReveal";

export function Improve() {
  return (
    <ProfileGate>
      {(p) => {
        const weak = weakestPillars(p);
        if (weak.length === 0) {
          return (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nothing to improve yet</CardTitle>
                  <CardDescription>We don&apos;t have enough data about you to suggest a path.</CardDescription>
                </CardHeader>
              </Card>
              <WhatIfPanel profile={p} />
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <p className="text-sm text-slate-500">
              These are your two lowest areas right now. Small, steady steps here will move your score the most.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              {weak.map(({ pillar, value }, i) => (
              <StudentReveal key={pillar}>
              <Card className="h-full rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-baseline justify-between gap-3">
                      <CardTitle className="text-lg">{i + 1}. {PILLAR_LABEL[pillar]}</CardTitle>
                      <span className="text-sm tabular-nums text-slate-500">{value.toFixed(0)} / 100</span>
                    </div>
                    <CardDescription>{PLAYBOOK[pillar].why}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3">
                      {PLAYBOOK[pillar].steps.map((s, j) => (
                        <li key={s} className="flex gap-3 text-sm">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">{j + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </StudentReveal>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              Looking for courses? See <Link href="/student/certifications" className="font-medium underline underline-offset-2">suggested certifications</Link>.
            </p>
            <details className="group rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-inset">
                <span className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                  <span>Full progress breakdown</span>
                  <span className="text-xs font-normal text-slate-500">Scores, risk indicators, and supporting details</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="space-y-6 border-t border-slate-100 p-5">
                <section aria-labelledby="pillar-scores-heading">
                  <h2 id="pillar-scores-heading" className="text-sm font-semibold">Progress by area</h2>
                  <p className="mt-1 text-xs text-slate-500">Each area is scored out of 100. Missing records are shown as not assessed.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {PILLARS.map((pillar) => {
                      const value = p.pillars[pillar];
                      return (
                        <div key={pillar} className="rounded-md border border-slate-100 p-3">
                          <div className="mb-2 flex justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-700">{PILLAR_LABEL[pillar]}</span>
                            <span className="tabular-nums text-slate-500">{value === null ? "Not assessed" : `${fmt(value, 0)} / 100`}</span>
                          </div>
                          {value !== null && <StudentProgress value={value} label={PILLAR_LABEL[pillar]} />}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  {[{ label: "Academic outlook", risk: p.academic_risk }, { label: "Career outlook", risk: p.placement_risk }].map(({ label, risk }) => (
                    <section key={label} className="rounded-md border border-slate-100 p-4" aria-label={label}>
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${TIER_STYLE[risk.level]}`}>
                          {risk.level === "Red" || risk.level === "Amber" ? "Needs a check-in" : risk.level === "Green" ? "No current flags" : "Not assessed"}
                        </span>
                      </div>
                      {risk.drivers.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">{risk.level === "Not assessed" ? "This area has not been assessed yet." : "No current indicators are outside the scoring thresholds."}</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {risk.drivers.map((driver) => (
                            <li key={driver.label} className="flex items-start justify-between gap-3 text-xs">
                              <span className="text-slate-600">{driver.label}</span>
                              <span className="shrink-0 font-medium tabular-nums text-slate-800">{driver.value}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>

                <section aria-labelledby="record-facts-heading">
                  <h2 id="record-facts-heading" className="text-sm font-semibold">From your records</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Attendance", fmt(p.metrics.attendance_pct, 0, "%")],
                      ["CGPA", fmt(p.metrics.cgpa, 2)],
                      ["Backlogs", fmt(p.metrics.backlogs, 0)],
                      ["Certifications", fmt(p.metrics.certifications, 0)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-slate-50 p-3">
                        <dt className="text-[10px] text-slate-500">{label}</dt>
                        <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </details>
            <WhatIfPanel profile={p} />
          </div>
        );
      }}
    </ProfileGate>
  );
}
