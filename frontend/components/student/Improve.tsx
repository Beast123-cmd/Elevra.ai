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
            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-base font-semibold tracking-tight text-[#172824]">Your two focus areas</h2><p className="mt-1 text-sm text-slate-500">Ranked by the lowest scores with available data.</p></div>
              <span className="text-xs text-slate-500">3 suggested actions each</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {weak.map(({ pillar, value }, i) => (
              <StudentReveal key={pillar}>
              <Card className="h-full overflow-hidden rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.025] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#b8cec3] hover:shadow-md">
                  <CardHeader className="border-b border-slate-100 bg-[#fbfcfb] px-5 pb-4 pt-5 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">Focus {i + 1}</p><CardTitle className="mt-1 text-lg text-[#172824]">{PILLAR_LABEL[pillar]}</CardTitle></div>
                      <span className="shrink-0 rounded-full bg-[#eef3f0] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#315c50]">{value.toFixed(0)} <span className="font-normal text-slate-500">/ 100</span></span>
                    </div>
                    <div className="mt-4"><StudentProgress value={value} label={`${PILLAR_LABEL[pillar]} score`} /></div>
                    <CardDescription className="mt-3 leading-5">{PLAYBOOK[pillar].why}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 py-5 sm:px-6">
                    <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-[#dce7e1]">
                      {PLAYBOOK[pillar].steps.map((s, j) => (
                        <li key={s} className="relative flex gap-3 text-sm leading-5 text-slate-700">
                          <span className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#c9dcd2] bg-white text-[11px] font-semibold tabular-nums text-[#286a62]">{j + 1}</span>
                          <span className="pt-0.5">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </StudentReveal>
              ))}
            </div>
            <Link href="/student/certifications" className="group flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#dce7e1] bg-white px-4 py-3 text-sm font-semibold text-[#1d6158] no-underline transition-[border-color,background-color] hover:border-[#b8cec3] hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
              <span><span className="block text-[#172824]">Want to build a skill?</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Browse certifications matched to your focus areas</span></span>
              <span className="shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
            <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-[#172824] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-inset sm:px-5">
                <span className="min-w-0"><span className="block">See all scores and supporting details</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Full progress breakdown</span></span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
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
