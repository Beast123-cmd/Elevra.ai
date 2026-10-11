"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, CalendarCheck2 } from "lucide-react";
import { BAND_COLOR, TIER_STYLE, fmt } from "@/lib/format";
import { type Pillar, type Profile, type Tier } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentProfile } from "./useStudentProfile";

const SUMMARY: { key: Pillar; label: string; icon: typeof BookOpen; href: string; suffix?: string }[] = [
  { key: "academic", label: "Academic progress", icon: BookOpen, href: "/student/improve" },
  { key: "attendance", label: "Attendance", icon: CalendarCheck2, href: "/student/improve", suffix: "%" },
  { key: "placement", label: "Career readiness", icon: BriefcaseBusiness, href: "/student/certifications" },
];

function RiskLabel({ label, tier }: { label: string; tier: Tier }) {
  const message = tier === "Red" || tier === "Amber" ? "Needs a check-in" : tier === "Green" ? "No current flags" : "Not assessed";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${TIER_STYLE[tier]}`}>
      <span className="text-slate-500">{label}</span><span aria-hidden="true">·</span>{message}
    </span>
  );
}

function Dashboard({ profile }: { profile: Profile }) {
  const academicDriver = profile.academic_risk.drivers[0];
  const suggestedAction = profile.actions[0];
  const attentionNeeded = profile.academic_risk.level === "Red" || profile.academic_risk.level === "Amber";

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
      <header className="mb-6 flex flex-col gap-1 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#286a62]">Your student space</p>
          <h1 className="mt-1 break-words text-[clamp(1.5rem,5vw,1.85rem)] font-semibold tracking-[-.04em] text-[#172824]">Hi, {profile.name}</h1>
          <p className="mt-1 text-sm text-slate-500">A clear view of your progress and what to focus on next.</p>
        </div>
        <p className="text-xs text-slate-500">{profile.department} <span className="px-1.5 text-slate-300">/</span> Year {profile.year}</p>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <Card className="min-w-0 overflow-hidden rounded-xl border-[#dce4df] shadow-sm shadow-slate-900/[0.025]">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-700">Your success score</p>
              <span className="rounded-full bg-[#f1f5f1] px-2.5 py-1 text-[11px] font-medium text-[#315c50]">{profile.band}</span>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-[clamp(3.5rem,13vw,4.25rem)] font-semibold leading-[.9] tracking-[-.07em] tabular-nums text-[#172824]" style={{ color: BAND_COLOR[profile.band] ?? "#172824" }}>{fmt(profile.score, 1)}</span>
              <span className="pb-1 text-sm text-slate-500">/ 100</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf1ed]" role="progressbar" aria-label="Success score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, profile.score))}>
              <div className="h-full rounded-full bg-[#286a62]" style={{ width: `${Math.max(0, Math.min(100, profile.score))}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>Based on the records currently available</span><span>{fmt(profile.confidence, 0)}% data coverage</span>
            </div>
            {profile.missing.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">Some areas are not assessed yet. Your score uses the data available today.</p>}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <RiskLabel label="Academic" tier={profile.academic_risk.level} />
              <RiskLabel label="Career" tier={profile.placement_risk.level} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-xl border-[#dce4df] bg-[#f4f7f4] shadow-sm shadow-slate-900/[0.02]">
          <CardContent className="flex h-full flex-col p-5 sm:p-7">
            <p className="text-xs font-semibold text-[#286a62]">A good place to start</p>
            <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-.025em] text-[#172824]">
              {attentionNeeded && academicDriver ? academicDriver.label : "Keep building on your progress"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {suggestedAction ?? "Explore your progress to find a useful next step."}
            </p>
            <Link href="/student/improve" className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 pt-5 text-sm font-semibold text-[#1d6158] no-underline hover:text-[#123f3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2">
              View my improvement plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="mt-7 sm:mt-9" aria-labelledby="progress-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="progress-heading" className="text-[15px] font-semibold tracking-tight text-[#172824]">Your progress at a glance</h2><p className="mt-1 text-xs text-slate-500">Choose an area to see more detail.</p></div>
          <Link href="/student/improve" className="text-xs font-semibold text-[#1d6158] no-underline hover:underline">View all progress <span aria-hidden="true">→</span></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SUMMARY.map(({ key, label, icon: Icon, href, suffix }) => {
            const value = profile.pillars[key];
            return (
              <Link key={key} href={href} className="group min-w-0 rounded-lg border border-[#e0e6e1] bg-white p-4 no-underline transition-colors hover:border-[#b8cec3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62] focus-visible:ring-offset-2 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600"><Icon className="h-4 w-4 text-[#5d8177]" aria-hidden="true" />{label}</div>
                <div className="mt-4 text-[27px] font-semibold leading-none tracking-[-.04em] tabular-nums text-[#172824]">
                  {value === null || value === undefined ? <span className="text-sm font-medium tracking-normal text-slate-400">Not assessed yet</span> : <>{fmt(value, 0)}{suffix}</>}
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[#286a62] group-hover:underline">View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-[#e0e6e1] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="text-sm font-semibold text-[#172824]">College updates</h2><p className="mt-1 text-xs text-slate-500">Placement drives and announcements shared with you.</p></div>
        <Link href="/student/notifications" className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[#1d6158] no-underline hover:underline">Open inbox <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

export function StudentHome() {
  const { state, mock } = useStudentProfile();

  if (state.status === "loading") {
    return <div className="mx-auto w-full max-w-[1120px] space-y-5 px-4 py-7 sm:px-6 lg:px-10" aria-busy="true"><div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-64" /></div><div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-60" /><Skeleton className="h-60" /></div><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div>;
  }
  if (state.status === "error") {
    return <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><Card role="alert" className="rounded-lg border-[#e0e6e1] shadow-sm"><CardContent className="p-5"><h1 className="font-semibold text-[#172824]">Couldn&apos;t load your dashboard</h1><p className="mt-1 text-sm text-slate-500">{state.message}. Try signing in again.</p></CardContent></Card></div>;
  }
  if (state.status === "empty") {
    return <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><Card className="rounded-lg border-[#e0e6e1] shadow-sm"><CardContent className="p-5"><h1 className="font-semibold text-[#172824]">Your dashboard is getting ready</h1><p className="mt-1 text-sm text-slate-500">Your score hasn&apos;t been calculated yet. Check back after the next data refresh.</p></CardContent></Card></div>;
  }

  return <>{mock && <p className="mx-auto mt-4 max-w-[1120px] px-4 text-xs text-amber-800 sm:px-6 lg:px-10">Preview mode · showing sample data</p>}<Dashboard profile={state.profile} /></>;
}
