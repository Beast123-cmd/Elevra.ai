"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge } from "@/components/shared/badges";
import { fmt, TIER_STYLE } from "@/lib/format";
import { PILLARS, type Pillar, type Profile } from "@/lib/types";
import { PILLAR_LABEL, PLAYBOOK } from "./playbook";
import { ProfileGate } from "./ProfileGate";
import { weakestPillars } from "./weakest";
import { WhatIfPanel } from "./WhatIfPanel";
import { StudentProgress } from "./StudentPage";
import { StudentReveal } from "./StudentReveal";
import { StudentNextStep } from "./StudentNextStep";

function routeFor(pillar: Pillar): { href: string; label: string } {
  if (pillar === "skills") return { href: "/student/certifications", label: "Find a course" };
  if (pillar === "placement") return { href: "/student/interview", label: "Practise an interview" };
  if (pillar === "engagement") return { href: "/student/hackathons", label: "Find an event" };
  return { href: "/student", label: "Review my progress" };
}

function FocusCard({ pillar, value, rank }: { pillar: Pillar; value: number; rank: number }) {
  const playbook = PLAYBOOK[pillar];
  const action = routeFor(pillar);
  const primaryStep = playbook.steps[0];

  return (
    <StudentReveal>
      <Card className={`h-full overflow-hidden rounded-xl border-[#dce7e1] shadow-sm shadow-slate-900/[0.025] ${rank === 1 ? "bg-[#f1f6f3]" : "bg-white"}`}>
        <CardHeader className="px-5 pb-3 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">{rank === 1 ? "Start here" : "Then focus on"}</p>
              <CardTitle className="mt-1 text-lg tracking-[-.02em] text-[#172824]">{PILLAR_LABEL[pillar]}</CardTitle>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#315c50] ring-1 ring-[#dce7e1]">
              {fmt(value, 0)} <span className="font-normal text-slate-500">/ 100</span>
            </span>
          </div>
          <div className="mt-3"><StudentProgress value={value} label={`${PILLAR_LABEL[pillar]} score`} /></div>
          <CardDescription className="mt-3 leading-5">{playbook.why}</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6">
          <div className="rounded-lg border border-[#dce7e1] bg-white px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">One useful next step</p>
            <p className="mt-1.5 text-sm leading-5 text-slate-700">{primaryStep}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Link href={action.href} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-[#1d6158] no-underline transition-colors hover:text-[#123f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
              {action.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {playbook.steps.length > 1 && (
              <details className="group">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
                  More steps<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ol className="mt-2 space-y-2 border-l border-[#d5e2db] pl-3">
                  {playbook.steps.slice(1).map((step, index) => (
                    <li key={step} className="flex gap-2 text-xs leading-5 text-slate-600">
                      <span className="font-semibold tabular-nums text-[#286a62]">{index + 2}.</span>{step}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </CardContent>
      </Card>
    </StudentReveal>
  );
}

function ProgressDetails({ profile }: { profile: Profile }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-[#172824] transition-colors hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
        <span className="min-w-0"><span className="block">See your full progress</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Scores, check-in indicators and the records behind them</span></span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="space-y-6 border-t border-slate-100 p-4 sm:p-5">
        <section aria-labelledby="pillar-scores-heading">
          <h2 id="pillar-scores-heading" className="text-sm font-semibold text-[#172824]">Progress by area</h2>
          <p className="mt-1 text-xs text-slate-500">Each score is out of 100. Missing records are marked as not assessed.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PILLARS.map((pillar) => {
              const value = profile.pillars[pillar];
              return (
                <div key={pillar} className="rounded-lg border border-[#e7eeea] bg-[#fbfcfb] p-3">
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
          {[{ label: "Academic outlook", risk: profile.academic_risk }, { label: "Career outlook", risk: profile.placement_risk }].map(({ label, risk }) => (
            <section key={label} className="rounded-lg border border-[#e7eeea] p-4" aria-label={label}>
              <div className="flex flex-wrap items-center justify-between gap-2">
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
          <h2 id="record-facts-heading" className="text-sm font-semibold text-[#172824]">From your records</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Attendance", fmt(profile.metrics.attendance_pct, 0, "%")],
              ["CGPA", fmt(profile.metrics.cgpa, 2)],
              ["Backlogs", fmt(profile.metrics.backlogs, 0)],
              ["Certifications", fmt(profile.metrics.certifications, 0)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#f4f7f5] p-3">
                <dt className="text-[10px] text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}

export function Improve() {
  return (
    <ProfileGate>
      {(profile) => {
        const focusAreas = weakestPillars(profile);
        const [primary, secondary] = focusAreas;

        return (
          <div className="space-y-5 sm:space-y-6">
            <div className="rounded-lg border border-[#e2ebe6] bg-[#f4f7f5] px-4 py-3 sm:px-5">
              <p className="text-sm leading-6 text-slate-600">Your suggestions use the records currently available. Start with one action; you can explore other scores and estimates when you need them.</p>
            </div>

            <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Current Success Score</p>
                  <p className="mt-1 text-3xl font-semibold tracking-[-.04em] tabular-nums text-[#172824]">
                    {fmt(profile.score, 1)}<span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
                  </p>
                </div>
                <div className="space-y-2">
                  <StudentProgress value={profile.score} label="Current Success Score" />
                  <p className="text-xs text-slate-500">Based on {profile.confidence}% of the score weight with assessed records.</p>
                </div>
                <BandBadge band={profile.band} />
              </CardContent>
            </Card>

            {primary ? (
              <section aria-labelledby="focus-heading" className="space-y-4">
                <div>
                  <h2 id="focus-heading" className="text-base font-semibold tracking-tight text-[#172824]">A manageable place to start</h2>
                  <p className="mt-1 text-sm text-slate-500">One practical action for your lowest area, then a second area to work on when you’re ready.</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FocusCard pillar={primary.pillar} value={primary.value} rank={1} />
                  {secondary && <FocusCard pillar={secondary.pillar} value={secondary.value} rank={2} />}
                </div>
              </section>
            ) : (
              <Card className="rounded-xl border-[#dce7e1] bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-[#172824]">Your plan is taking shape</CardTitle>
                  <CardDescription>We need more assessed records before suggesting focus areas. Your current details and scenario tool are still available below.</CardDescription>
                </CardHeader>
              </Card>
            )}

            <StudentNextStep
              label="CONTINUE YOUR PLAN"
              title="Find a course that matches your focus"
              description="See a short list of department-relevant courses, with matches to your assessed areas first."
              href="/student/certifications"
            />

            <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-[#172824] transition-colors hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
                <span className="min-w-0"><span className="block">Explore a score scenario</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Try changing study or career values to see an estimate</span></span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-slate-100 p-3 sm:p-5">
                <WhatIfPanel profile={profile} />
              </div>
            </details>

            <ProgressDetails profile={profile} />
          </div>
        );
      }}
    </ProfileGate>
  );
}
