"use client";
import { ClipboardCheck, MessageSquareText } from "lucide-react";
import { Fragment, useEffect, useId, useState, type ReactNode } from "react";
import { fmt } from "@/lib/format";
import type { Cohort, Profile, Risk } from "@/lib/types";
import { HistoryChart, PillarRadar, Waterfall, WeeklyTimeline } from "./charts";
import { BandTag, Panel, RiskTag } from "./ui-kit";

function RiskPanel({ title, risk }: { title: string; risk: Risk }) {
  return (
    <Panel title={title} actions={<RiskTag level={risk.level} />}>
      {risk.level === "Not assessed" ? (
        <p className="text-sm text-muted-foreground">No placement assessments yet (typical for 2nd-years). The score is re-weighted without this pillar.</p>
      ) : risk.drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No risk drivers triggered.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {risk.drivers.map((d) => (
            <li key={d.label} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
              <span>{d.label} <span className="text-muted-foreground">({d.value})</span></span>
              <span className="tabular shrink-0 font-mono text-xs text-risk-red" title="Points this adds to the risk tier">+{d.points}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

type Tab = "summary" | "timeline" | "record" | "support";

interface Props {
  profile: Profile;
  cohortMeans?: Cohort["pillar_means"];
  /** "faculty" shows the mentor's view; "student" uses supportive wording and hides mentor-only details. */
  mode: "faculty" | "student";
  /** Shown at the top of the Summary tab, e.g. the mentor brief. */
  brief?: ReactNode;
  /** The Support tab: message drafts and the intervention log. Without it the tab is hidden. */
  support?: ReactNode;
  /** Live score after admin weight changes; falls back to the stored score. */
  liveScore?: number;
}

/** Student 360: who the student is, why they are flagged, how they are trending, and what has been done. */
export function StudentProfile({ profile: s, cohortMeans, mode, brief, support, liveScore }: Props) {
  const m = s.metrics;
  const score = liveScore ?? s.score;
  const mine = mode === "student";
  const [tab, setTab] = useState<Tab>("summary");
  const base = useId();
  useEffect(() => setTab("summary"), [s.student_id]);

  const records: [string, string][] = [
    ["Academic", `CGPA ${fmt(m.cgpa, 2)} · backlogs ${fmt(m.backlogs)} · internals ${fmt(m.internal_pct, 0, "%")}`],
    ["Attendance", `${fmt(m.attendance_pct, 1, "%")} overall${m.min_subject_attendance == null ? "" : ` · lowest subject ${fmt(m.min_subject_attendance, 0, "%")}`}`],
    ["LMS", `submission ${fmt((m.submit_rate ?? NaN) * 100, 0, "%")} · active weeks ${fmt((m.login_consistency ?? NaN) * 100, 0, "%")}`],
    ["Engagement", `${fmt(m.events)} events · ${fmt(m.clubs)} clubs · ${fmt(m.hackathons)} hackathons · ${fmt(m.certifications)} certifications`],
    ["Placement", m.aptitude === null && m.coding === null ? "Not yet assessed" : `aptitude ${fmt(m.aptitude)} · coding ${fmt(m.coding)} · mock interview ${fmt(m.mock, 1)}/5`],
    ["Skills", `technical ${fmt(m.tech_skill)} · soft ${fmt(m.soft_skill)}`],
    ["Feedback", m.satisfaction === null && m.faculty_rating === null ? "No survey response" : `satisfaction ${fmt(m.satisfaction, 1)}/5 · faculty ${fmt(m.faculty_rating, 1)}/5`],
  ];
  const tabs: [Tab, string][] = [["summary", "Summary"], ["timeline", "Timeline"], ["record", "Unified record"], ...(support ? [["support", "Support"] as [Tab, string]] : [])];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Student 360</p>
            <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[32px]">{s.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{s.student_id}</span> · {s.department} · Year {s.year} · Batch {s.batch} · {s.residence}
              {!mine && <> · Mentor <span className="font-mono">{s.mentor_faculty_id}</span></>}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <RiskTag level={s.academic_risk.level} prefix="Academic" />
              <RiskTag level={s.placement_risk.level} prefix="Placement" />
              <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs">Segment · {s.segment}</span>
              {s.engagement_drop && <span className="inline-flex items-center rounded bg-risk-amber-bg px-1.5 py-0.5 text-xs font-medium text-risk-amber">{mine ? "Your LMS activity has dropped" : "LMS activity dropped sharply in weeks 6–8"}</span>}
              {s.declining && <span className="inline-flex items-center rounded bg-risk-red-bg px-1.5 py-0.5 text-xs font-medium text-risk-red">Score declining over two semesters</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-end gap-5 md:flex-col md:items-end md:gap-2">
            <div className="md:text-right">
              <p className="text-xs font-medium text-muted-foreground">Success score</p>
              <p className="tabular font-serif text-[44px] font-semibold leading-none tracking-[-0.02em]">{score.toFixed(1)}<span className="ml-1 font-sans text-sm font-normal text-muted-foreground">/100</span></p>
            </div>
            <div className="flex flex-col items-start gap-1 md:items-end">
              <BandTag band={s.band} />
              <p className="text-xs text-muted-foreground">Data confidence {s.confidence}%{s.missing.length > 0 && ` · missing ${s.missing.join(", ")}`}</p>
            </div>
          </div>
        </div>
        {support && (
          <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={() => setTab("support")} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />Log support
            </button>
            <button type="button" onClick={() => setTab("support")} className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />Write to student
            </button>
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Student details" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            id={`${base}-${key}`}
            aria-selected={tab === key}
            aria-controls={`${base}-${key}-panel`}
            onClick={() => setTab(key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${tab === key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${base}-${tab}-panel`} aria-labelledby={`${base}-${tab}`} className="space-y-4">
        {tab === "summary" && (
          <>
            {brief}
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Why this score?" description="Points each pillar adds or removes versus the cohort average." className="lg:col-span-2">
                <Waterfall contributions={s.contributions} />
              </Panel>
              <Panel title="Pillar profile" description={cohortMeans ? "This student against the cohort average." : "Pillar scores."}>
                <PillarRadar pillars={s.pillars} cohortMeans={cohortMeans} />
              </Panel>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <RiskPanel title="Academic risk" risk={s.academic_risk} />
              <RiskPanel title="Placement risk" risk={s.placement_risk} />
              <Panel title={mine ? "Your next steps" : "Recommended actions"}>
                {s.actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{mine ? "You are on track. Keep it up." : "Routine monthly check-in."}</p>
                ) : (
                  <ol className="space-y-1.5 text-sm">
                    {s.actions.map((a, i) => <li key={a} className="flex gap-2"><span className="tabular font-mono text-xs text-muted-foreground">{i + 1}.</span>{a}</li>)}
                  </ol>
                )}
                <div className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  Early-warning model: <b className="text-foreground">{(s.model.prob * 100).toFixed(0)}%</b> estimated chance of a backlog this semester.
                  <ul className="mt-1 space-y-0.5">
                    {s.model.factors.map((f) => <li key={f.feature}>{f.effect > 0 ? "Raises" : "Lowers"} risk: {f.label}</li>)}
                  </ul>
                </div>
              </Panel>
            </div>
          </>
        )}

        {tab === "timeline" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Weekly timeline" description="LMS activity usually drops before attendance, and attendance before marks."><WeeklyTimeline weekly={s.weekly} /></Panel>
            <Panel title="Score history" description="Success score at the end of each completed semester."><HistoryChart history={s.history} /></Panel>
          </div>
        )}

        {tab === "record" && (
          <Panel title="Unified record" description="One row per student, joined from seven separate campus systems.">
            <dl className="divide-y divide-border text-sm">
              {records.map(([k, v]) => (
                <Fragment key={k}>
                  <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
                    <dt className="font-medium text-muted-foreground">{k}</dt>
                    <dd className="tabular">{v}</dd>
                  </div>
                </Fragment>
              ))}
            </dl>
          </Panel>
        )}

        {tab === "support" && support}
      </div>
    </div>
  );
}
