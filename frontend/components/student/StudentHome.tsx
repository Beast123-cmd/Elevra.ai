"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BriefcaseBusiness, CalendarCheck2 } from "lucide-react";
import { BAND_COLOR, TIER_STYLE, fmt } from "@/lib/format";
import { type Pillar, type Profile, type Tier } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PILLAR_LABEL } from "./playbook";
import { useStudentProfile } from "./useStudentProfile";

const SUMMARY_PILLARS: { key: Pillar; label: string; href: string; icon: typeof BookOpen; note: (p: Profile) => string }[] = [
  {
    key: "academic",
    label: "Academics",
    href: "/student/improve",
    icon: BookOpen,
    note: (p) => p.metrics.backlogs === null || p.metrics.backlogs === undefined
      ? "Academic progress"
      : `${fmt(p.metrics.backlogs, 0)} active backlogs`,
  },
  {
    key: "placement",
    label: "Career readiness",
    href: "/student/certifications",
    icon: BriefcaseBusiness,
    note: (p) => p.pillars.placement === null ? "Not assessed yet" : "View your next steps",
  },
  {
    key: "lms",
    label: "Learning activity",
    href: "/student/improve",
    icon: CalendarCheck2,
    note: (p) => p.pillars.lms === null ? "Not assessed yet" : "Online learning activity",
  },
];

function TierPill({ label, tier }: { label: string; tier: Tier }) {
  const message = tier === "Red" || tier === "Amber" ? "Needs a check-in" : tier === "Green" ? "No current flags" : "Not assessed";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${TIER_STYLE[tier]}`}>
      <span className="text-slate-500">{label}:</span>{message}
    </span>
  );
}

function Dashboard({ profile }: { profile: Profile }) {
  const attendance = profile.metrics.attendance_pct ?? profile.pillars.attendance;
  const attendanceDriver = profile.academic_risk.drivers.find((driver) => driver.label.toLowerCase().includes("attendance"));
  const suggestedAction = profile.actions[0];

  return (
    <div className="mx-auto w-full max-w-[1030px] space-y-5 px-4 py-7 sm:px-6 lg:py-9">
      <header className="mb-6">
        <h1 className="text-[23px] font-semibold tracking-tight text-slate-900">Welcome back, {profile.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Here&apos;s a quick look at your progress.</p>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,.85fr)]">
        <div className="min-w-0">
          <Card className="rounded-lg border-slate-200 shadow-sm shadow-slate-900/[0.02]">
            <CardContent className="p-5 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-slate-500">
                    {attendanceDriver ? "One thing to focus on" : "Your next step"}
                  </p>
                  <h2 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
                    {attendanceDriver ? "Your attendance could use attention" : "A suggested next step for you"}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {attendanceDriver
                      ? attendanceDriver.label
                      : suggestedAction ?? "No suggested action is available from your current records."}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${TIER_STYLE[profile.academic_risk.level]}`}>
                  {profile.academic_risk.level === "Red" || profile.academic_risk.level === "Amber"
                    ? "Needs a check-in"
                    : profile.academic_risk.level === "Green" ? "No current flags" : "Not assessed"}
                </span>
              </div>

              {attendance !== null && attendance !== undefined && (
                <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="min-w-[47px] text-[21px] font-semibold tracking-tight tabular-nums text-slate-900">{fmt(attendance, 0, "%")}</span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label="Attendance"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.max(0, Math.min(100, attendance))}
                  >
                    <div className={`h-full rounded-full ${attendanceDriver ? "bg-amber-600" : "bg-teal-700"}`} style={{ width: `${Math.max(0, Math.min(100, attendance))}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-slate-500">Attendance</span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-[10px] text-slate-500">Based on your current college records</span>
                <Link href="/student/improve" className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-teal-800 transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                  View my plan <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <section className="mt-5" aria-labelledby="at-a-glance-heading">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 id="at-a-glance-heading" className="text-xs font-semibold text-slate-800">At a glance</h2>
              <Link href="/student/improve" className="text-[10px] font-medium text-teal-800 hover:underline">View my plan <span aria-hidden="true">→</span></Link>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {SUMMARY_PILLARS.map(({ key, label, href, icon: Icon, note }) => {
                const value = profile.pillars[key];
                return (
                  <Link key={key} href={href} className="group rounded-lg border border-slate-200 bg-white p-3.5 no-underline shadow-sm shadow-slate-900/[0.02] transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{label}
                    </div>
                    <div className="mt-2 text-[23px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                      {value === null ? <span className="text-sm font-medium text-slate-400">Not assessed</span> : fmt(value, 0)}
                    </div>
                    <p className="mt-1.5 truncate text-[10px] text-slate-500">{note(profile)}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="grid gap-3" aria-label="Your overall progress">
          <Card className="rounded-lg border-slate-200 shadow-sm shadow-slate-900/[0.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-800">Overall progress</h2>
                <span className="grid h-4 w-4 place-items-center rounded-full border border-slate-300 text-[10px] text-slate-500" title="A summary of your available college records" aria-label="A summary of your available college records">i</span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[36px] font-semibold leading-none tracking-[-.06em] tabular-nums" style={{ color: BAND_COLOR[profile.band] ?? "#334155" }}>{fmt(profile.score, 1)}</span>
                <span className="text-[10px] text-slate-500">out of 100</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{profile.band} · confidence {fmt(profile.confidence, 0)}%</p>
              <div className="my-3 border-t border-slate-100" />
              <p className="text-[10px] leading-relaxed text-slate-500">This is a guidance signal, not a grade. It reflects the records currently available.</p>
              {profile.missing.length > 0 && (
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  No data yet for {profile.missing.map((pillar) => PILLAR_LABEL[pillar].toLowerCase()).join(", ")}.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <TierPill label="Academic" tier={profile.academic_risk.level} />
                <TierPill label="Career" tier={profile.placement_risk.level} />
              </div>
              <p className="mt-3 text-[10px] text-slate-500">Your current group: <span className="font-medium text-slate-700">{profile.segment}</span></p>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-slate-200 shadow-sm shadow-slate-900/[0.02]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold text-slate-800">College updates</h2>
                <Link href="/student/notifications" className="text-[10px] font-medium text-teal-800 hover:underline">Inbox <span aria-hidden="true">→</span></Link>
              </div>
              <p className="mt-3 rounded-md bg-slate-50 px-3 py-2.5 text-[10px] text-slate-500">Open your inbox for placement drives and college announcements.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function StudentHome() {
  const { state, mock } = useStudentProfile();

  if (state.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1030px] space-y-5 px-4 py-7 sm:px-6 lg:py-9" aria-busy="true">
        <div className="space-y-2"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-64" /></div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,.85fr)]"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
        <div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-[1030px] px-4 py-7 sm:px-6 lg:py-9">
        <Card role="alert" className="rounded-lg border-slate-200 shadow-sm">
          <CardContent className="p-5"><h1 className="font-semibold text-slate-900">Couldn&apos;t load your dashboard</h1><p className="mt-1 text-sm text-slate-500">{state.message}. Try signing in again.</p></CardContent>
        </Card>
      </div>
    );
  }
  if (state.status === "empty") {
    return (
      <div className="mx-auto max-w-[1030px] px-4 py-7 sm:px-6 lg:py-9">
        <Card className="rounded-lg border-slate-200 shadow-sm"><CardContent className="p-5"><h1 className="font-semibold text-slate-900">Your dashboard is getting ready</h1><p className="mt-1 text-sm text-slate-500">Your score hasn&apos;t been calculated yet. Check back after the next data refresh.</p></CardContent></Card>
      </div>
    );
  }

  return <>{mock && <p className="mx-auto mt-5 max-w-[1030px] px-4 text-xs text-amber-800 sm:px-6">Preview mode · showing sample data</p>}<Dashboard profile={state.profile} /></>;
}
