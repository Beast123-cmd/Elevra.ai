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

function routeFor(pillar: Pillar): { href: string; label: string } {
  if (pillar === "skills") return { href: "/student/certifications", label: "Browse matching courses" };
  if (pillar === "placement") return { href: "/student/interview", label: "Practise an interview" };
  if (pillar === "engagement") return { href: "/student/hackathons", label: "Find a campus event" };
  return { href: "#progress-details", label: "See what is behind this" };
}

function PrimaryFocus({ pillar, value }: { pillar: Pillar; value: number }) {
  const playbook = PLAYBOOK[pillar];
  const action = routeFor(pillar);

  return (
    <Card className="overflow-hidden rounded-xl border-[#cbded4] bg-[#edf4f0] shadow-sm shadow-slate-900/[0.025]">
      <CardHeader className="px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#286a62]">Your next step</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <CardTitle className="text-xl tracking-[-.025em] text-[#172824]">{PILLAR_LABEL[pillar]}</CardTitle>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#315c50] ring-1 ring-[#dce7e1]">{fmt(value, 0)} <span className="font-normal text-slate-500">/ 100</span></span>
        </div>
        <CardDescription className="mt-1 leading-5">{playbook.why}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="rounded-lg border border-[#d5e2db] bg-white px-3.5 py-3.5 sm:px-4">
          <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">Try this first</p>
          <p className="mt-1.5 text-sm leading-5 text-slate-700">{playbook.steps[0]}</p>
        </div>
        <Link href={action.href} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-md bg-[#15564e] px-3.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-[#10463f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
          {action.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

function ScoreSummary({ profile }: { profile: Profile }) {
  return (
    <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
      <CardHeader className="px-5 pb-2 pt-5 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Overall progress</p>
        <CardTitle className="mt-1 text-3xl font-semibold tracking-[-.04em] tabular-nums text-[#172824]">{fmt(profile.score, 1)}<span className="ml-1 text-sm font-normal text-slate-400">/ 100</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5 pb-5">
        <BandBadge band={profile.band} />
        <StudentProgress value={profile.score} label="Current Success Score" />
        <p className="text-xs leading-5 text-slate-500">Uses records for {profile.confidence}% of the score weight.</p>
      </CardContent>
    </Card>
  );
}

function OtherFocus({ pillar, value }: { pillar: Pillar; value: number }) {
  const playbook = PLAYBOOK[pillar];
  return (
    <details className="group rounded-xl border border-[#dce7e1] bg-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-[#172824] hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
        <span>See another area to work on <span className="font-normal text-slate-500">· {PILLAR_LABEL[pillar]}, {fmt(value, 0)}/100</span></span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
        <p className="text-sm leading-5 text-slate-600">{playbook.why}</p>
        <p className="mt-3 rounded-lg bg-[#f4f7f5] px-3.5 py-3 text-sm leading-5 text-slate-700">{playbook.steps[0]}</p>
      </div>
    </details>
  );
}

function ProgressDetails({ profile }: { profile: Profile }) {
  return (
    <details id="progress-details" className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
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
          <div className="space-y-4 sm:space-y-5">
            {primary ? (
              <StudentReveal>
                <section aria-label="Your suggested next step" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,.7fr)]">
                  <div>
                    <p className="mb-2 text-xs leading-5 text-slate-500">Based on your records, we picked one area to focus on first.</p>
                    <PrimaryFocus pillar={primary.pillar} value={primary.value} />
                  </div>
                  <ScoreSummary profile={profile} />
                </section>
              </StudentReveal>
            ) : (
              <Card className="rounded-xl border-[#dce7e1] bg-white">
                <CardHeader>
                  <CardTitle className="text-base text-[#172824]">Your plan is taking shape</CardTitle>
                  <CardDescription>We need more assessed records before suggesting focus areas. Your current details and scenario tool are still available below.</CardDescription>
                </CardHeader>
              </Card>
            )}

            {secondary && <OtherFocus pillar={secondary.pillar} value={secondary.value} />}

            <details className="group overflow-hidden rounded-xl border border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-sm font-semibold text-[#172824] transition-colors hover:bg-[#f7faf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-inset sm:px-5">
                <span className="min-w-0"><span className="block">Explore a score estimate</span><span className="mt-0.5 block text-xs font-normal text-slate-500">See how changing study or career values could affect your score</span></span>
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
