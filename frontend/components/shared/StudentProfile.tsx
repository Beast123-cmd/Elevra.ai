"use client";
import { Fragment, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import type { Cohort, Profile, Risk } from "@/lib/types";
import { BandBadge, RiskBadge } from "./badges";
import { HistoryChart, PillarRadar, Waterfall, WeeklyTimeline } from "./charts";

function Section({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </Card>
  );
}

function RiskCard({ title, risk }: { title: string; risk: Risk }) {
  return (
    <Section title={title}>
      <RiskBadge level={risk.level} />
      {risk.level === "Not assessed" ? (
        <p className="mt-2 text-sm text-slate-500">
          No placement assessments yet (typical for 2nd-years). The score is re-weighted without this pillar.
        </p>
      ) : risk.drivers.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No risk drivers triggered.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {risk.drivers.map((d) => (
            <li key={d.label} className="flex justify-between gap-2">
              <span>
                {d.label} <span className="text-slate-500">({d.value})</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-red-700">+{d.points}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

interface Props {
  profile: Profile;
  cohortMeans?: Cohort["pillar_means"];
  /** "faculty" shows the mentor's view; "student" uses supportive wording and hides mentor-only details. */
  mode: "faculty" | "student";
  /** Slot for page-specific actions, e.g. the Log intervention button or the what-if panel. */
  actions?: ReactNode;
  /** Live score after admin weight changes; falls back to the stored score. */
  liveScore?: number;
}

export function StudentProfile({ profile: s, cohortMeans, mode, actions, liveScore }: Props) {
  const m = s.metrics;
  const score = liveScore ?? s.score;
  const mine = mode === "student";
  const records: [string, string][] = [
    ["Academic", `CGPA ${fmt(m.cgpa, 2)} · backlogs ${fmt(m.backlogs)} · internals ${fmt(m.internal_pct, 0, "%")}`],
    ["Attendance", `${fmt(m.attendance_pct, 1, "%")} overall · lowest subject ${fmt(m.min_subject_attendance, 0, "%")}`],
    ["LMS", `submission ${fmt((m.submit_rate ?? NaN) * 100, 0, "%")} · active weeks ${fmt((m.login_consistency ?? NaN) * 100, 0, "%")}`],
    ["Engagement", `${fmt(m.events)} events · ${fmt(m.clubs)} clubs · ${fmt(m.hackathons)} hackathons · ${fmt(m.certifications)} certifications`],
    [
      "Placement",
      m.aptitude === null && m.coding === null
        ? "Not yet assessed"
        : `aptitude ${fmt(m.aptitude)} · coding ${fmt(m.coding)} · mock interview ${fmt(m.mock, 1)}/5`,
    ],
    ["Skills", `technical ${fmt(m.tech_skill)} · soft ${fmt(m.soft_skill)}`],
    [
      "Feedback",
      m.satisfaction === null && m.faculty_rating === null
        ? "No survey response"
        : `satisfaction ${fmt(m.satisfaction, 1)}/5 · faculty ${fmt(m.faculty_rating, 1)}/5`,
    ],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">{s.name}</h1>
          <p className="text-sm text-slate-500">
            {s.student_id} · {s.department} · Year {s.year} · Batch {s.batch} · {s.residence}
            {!mine && ` · Mentor ${s.mentor_faculty_id}`}
          </p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-4xl font-bold">{score.toFixed(1)}</div>
          <BandBadge band={s.band} />
          <div className="mt-1 text-xs text-slate-500">
            Data confidence {s.confidence}%{s.missing.length > 0 && ` · missing: ${s.missing.join(", ")}`}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
          Segment: <b>{s.segment}</b>
        </span>
        {s.engagement_drop && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
            ⚠ {mine ? "Your LMS activity has dropped in recent weeks" : "Early warning: LMS activity dropped sharply in weeks 6–8"}
          </span>
        )}
        {s.declining && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-800">↘ Score declining over two semesters</span>
        )}
      </div>

      {actions}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Why this score?" subtitle="Points each pillar adds or removes versus the cohort average" className="lg:col-span-2">
          <Waterfall contributions={s.contributions} />
        </Section>
        <Section title="Pillar profile" subtitle={cohortMeans ? "You vs cohort average" : "Pillar scores"}>
          <PillarRadar pillars={s.pillars} cohortMeans={cohortMeans} />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RiskCard title="Academic risk" risk={s.academic_risk} />
        <RiskCard title="Placement risk" risk={s.placement_risk} />
        <Section title={mine ? "Your next steps" : "Recommended actions"}>
          {s.actions.length === 0 ? (
            <p className="text-sm text-slate-500">{mine ? "You are on track. Keep it up." : "Routine monthly check-in."}</p>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {s.actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          )}
          <div className="mt-4 border-t pt-3 text-xs text-slate-500">
            Early-warning model: <b>{(s.model.prob * 100).toFixed(0)}%</b> estimated chance of a backlog this semester. Main factors:
            <ul className="mt-1">
              {s.model.factors.map((f) => (
                <li key={f.feature}>
                  {f.effect > 0 ? "▲ raises" : "▼ lowers"} risk: {f.label}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Weekly timeline" subtitle="LMS activity usually drops before attendance, and attendance before marks">
          <WeeklyTimeline weekly={s.weekly} />
        </Section>
        <Section title="Score history">
          <HistoryChart history={s.history} />
        </Section>
      </div>

      <Section title="Unified record: all 7 sources">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-sm">
          {records.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="font-medium text-slate-600">{k}</dt>
              <dd className="text-slate-800">{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Section>
    </div>
  );
}
