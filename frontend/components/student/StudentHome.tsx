"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, CalendarCheck2 } from "lucide-react";
import { fmt } from "@/lib/format";
import { TIER_CLASS } from "./tierClass";
import { type Pillar, type Profile, type Tier } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Meter, Ring, type Tone } from "@/components/shared/viz";
import { StudentLoading } from "./StudentPage";
import { StudentReveal } from "./StudentReveal";
import { useStudentProfile } from "./useStudentProfile";

const BAND_TONE: Record<string, Tone> = { Thriving: "green", "On Track": "primary", "Needs Attention": "highlight", Critical: "red" };
/** Attendance is judged against the 75% rule and the 65% detention line; every other area against 60 and 45. */
const toneFor = (key: Pillar, v: number | null | undefined): Tone => (v == null ? "none" : key === "attendance" ? (v >= 75 ? "primary" : v >= 65 ? "highlight" : "red") : v >= 60 ? "primary" : v >= 45 ? "highlight" : "red");
const PILLAR_ROWS: [Pillar, string][] = [["academic", "Academic"], ["attendance", "Attendance"], ["lms", "Learning activity"], ["placement", "Career readiness"], ["skills", "Skills"]];

const SUMMARY: { key: Pillar; label: string; icon: typeof BookOpen; href: string; suffix?: string }[] = [
  { key: "academic", label: "Academic progress", icon: BookOpen, href: "/student/improve" },
  { key: "attendance", label: "Attendance", icon: CalendarCheck2, href: "/student/improve", suffix: "%" },
  { key: "placement", label: "Career readiness", icon: BriefcaseBusiness, href: "/student/certifications" },
];

function RiskLabel({ label, tier }: { label: string; tier: Tier }) {
  const message = tier === "Red" || tier === "Amber" ? "Needs a check-in" : tier === "Green" ? "No current flags" : "Not assessed";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${TIER_CLASS[tier]}`}>
      <span className="text-muted-foreground">{label}</span><span aria-hidden="true">·</span>{message}
    </span>
  );
}

function Dashboard({ profile }: { profile: Profile }) {
  const academicDriver = profile.academic_risk.drivers[0];
  const suggestedAction = profile.actions[0];
  const attentionNeeded = profile.academic_risk.level === "Red" || profile.academic_risk.level === "Amber";

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
      <header className="mb-6 flex flex-col gap-1 border-l-2 border-primary pl-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Your student space</p>
          <h1 className="mt-1 break-words text-[clamp(1.5rem,5vw,1.85rem)] font-semibold tracking-[-.04em] text-foreground">Hi, {profile.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">A clear view of your progress and what to focus on next.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-0.5 font-semibold tabular-nums text-primary" title="Quote this ID when you contact your mentor">ID {profile.student_id}</span>
          <span className="px-1.5 text-muted-foreground/70">/</span>{profile.department} <span className="px-1.5 text-muted-foreground/70">/</span> Year {profile.year}
        </p>
      </header>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[1.08fr_.92fr]">
        <StudentReveal>
        <Card className="min-w-0 overflow-hidden rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.03]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-semibold text-foreground">Success score</p><p className="mt-0.5 text-[11px] text-muted-foreground">A snapshot of your current progress</p></div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary">{profile.band}</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-6">
              <Ring value={profile.score} size={140} stroke={13} tone={BAND_TONE[profile.band] ?? "primary"} label={`Success score ${fmt(profile.score, 1)} out of 100, ${profile.band}`}>
                <span>
                  <span className="tabular block font-serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-foreground">{fmt(profile.score, 1)}</span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">out of 100</span>
                </span>
              </Ring>
              <ul className="min-w-[180px] flex-1 space-y-2.5">
                {PILLAR_ROWS.map(([key, label]) => {
                  const v = profile.pillars[key];
                  return (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-[12px]"><span className="text-muted-foreground">{label}</span><span className="tabular font-medium">{v == null ? "–" : fmt(v, 0)}</span></div>
                      <Meter value={v} target={key === "attendance" ? 75 : undefined} tone={toneFor(key, v)} height={6} showTarget={key === "attendance"} label={v == null ? `${label}: not assessed` : `${label} ${fmt(v, 0)} out of 100`} />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Based on the records currently available</span><span>{fmt(profile.confidence, 0)}% data coverage</span>
            </div>
            {profile.missing.length > 0 && <p className="mt-3 text-xs leading-5 text-muted-foreground">Some areas are not assessed yet. Your score uses the data available today.</p>}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <RiskLabel label="Academic" tier={profile.academic_risk.level} />
              <RiskLabel label="Career" tier={profile.placement_risk.level} />
            </div>
          </CardContent>
        </Card>
        </StudentReveal>

        <StudentReveal>
        <Card className="min-w-0 rounded-xl border-border bg-muted shadow-sm shadow-slate-900/[0.02]">
          <CardContent className="flex flex-col p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-primary">Recommended next step</p>
            <h2 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-.025em] text-foreground">
              {attentionNeeded && academicDriver ? academicDriver.label : "Keep building on your progress"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {suggestedAction ?? "Explore your progress to find a useful next step."}
            </p>
            <Link href="/student/improve" className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              View my improvement plan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
        </StudentReveal>
      </div>

      <StudentReveal>
      <section className="mt-7 sm:mt-9" aria-labelledby="progress-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="progress-heading" className="text-[15px] font-semibold tracking-tight text-foreground">Your progress at a glance</h2><p className="mt-1 text-xs text-muted-foreground">Choose an area to see more detail.</p></div>
          <Link href="/student/improve" className="text-xs font-semibold text-primary no-underline hover:underline">View all progress <span aria-hidden="true">→</span></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SUMMARY.map(({ key, label, icon: Icon, href, suffix }) => {
            const value = profile.pillars[key];
            return (
              <StudentReveal key={key}>
              <Link href={href} className="group block h-full min-w-0 rounded-lg border border-border bg-card p-4 no-underline transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-input hover:shadow-md hover:shadow-slate-900/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{label}</div>
                <div className="mt-4 font-serif text-[30px] font-semibold leading-none tracking-[-.02em] tabular-nums text-foreground">
                  {value === null || value === undefined ? <span className="font-sans text-sm font-medium tracking-normal text-muted-foreground">Not assessed yet</span> : <>{fmt(value, 0)}{suffix}</>}
                </div>
                {value != null && <div className="mt-3"><Meter value={value} target={key === "attendance" ? 75 : undefined} tone={toneFor(key, value)} label={`${label} ${fmt(value, 0)} out of 100`} /></div>}
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary group-hover:underline">View details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
              </Link>
              </StudentReveal>
            );
          })}
        </div>
      </section>
      </StudentReveal>

      <StudentReveal>
      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="text-sm font-semibold text-foreground">College updates</h2><p className="mt-1 text-xs text-muted-foreground">Placement drives and announcements shared with you.</p></div>
        <Link href="/student/notifications" className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary no-underline hover:underline">Open inbox <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
      </div>
      </StudentReveal>
    </div>
  );
}

export function StudentHome() {
  const { state, mock, retry } = useStudentProfile();

  if (state.status === "loading") {
    return <div className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><StudentLoading rows={3} /></div>;
  }
  if (state.status === "error") {
    return <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><Card role="alert" className="rounded-lg border-border shadow-sm"><CardContent className="p-5"><h1 className="font-semibold text-foreground">Couldn&apos;t load your dashboard</h1><p className="mt-1 text-sm text-muted-foreground">{state.message}. Check your connection, then retry.</p><Button onClick={retry} variant="outline" className="mt-4">Retry</Button></CardContent></Card></div>;
  }
  if (state.status === "empty") {
    return <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-6 lg:px-10"><Card className="rounded-lg border-border shadow-sm"><CardContent className="p-5"><h1 className="font-semibold text-foreground">Your dashboard is getting ready</h1><p className="mt-1 text-sm text-muted-foreground">Your score hasn&apos;t been calculated yet. Check back after the next data refresh.</p></CardContent></Card></div>;
  }

  return <>{mock && <p className="mx-auto mt-4 max-w-[1120px] px-4 text-xs text-risk-amber sm:px-6 lg:px-10">Preview mode · showing sample data</p>}<Dashboard profile={state.profile} /></>;
}
