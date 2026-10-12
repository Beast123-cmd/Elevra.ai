"use client";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Meter, VisualStat, MiniRing } from "@/components/shared/viz";
import { Empty, Panel } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  hasResults, LEVEL_LABEL, PRACTICE_BELOW, scoreTone, share, TOPIC_LABEL, topicsByNeed, weekChange,
  type GroupShare, type PracticeOverview, type TopicStat,
} from "@/components/shared/practiceUi";

const LEVELS = ["easy", "medium", "hard"] as const;

function Participation({ data }: { data: PracticeOverview["participation"] }) {
  const pct = share(data.practised_this_week, data.total_students);
  return (
    <Panel title="Practice this week" description="Students who took a daily challenge or started a mock test in the last 7 days.">
      <div className="grid gap-3 sm:grid-cols-2">
        <VisualStat label="Practised this week" value={`${data.practised_this_week.toLocaleString()} of ${data.total_students.toLocaleString()}`}
          note={`${weekChange(data.practised_this_week, data.practised_last_week)} · ${pct}% of students`}
          visual={<MiniRing pct={pct} tone="primary" label={`${pct}% of students practised this week`} />} />
        <VisualStat label="Checked in this week" value={data.checked_in_this_week.toLocaleString()}
          note="opened their daily check-in at least once"
          visual={<MiniRing pct={share(data.checked_in_this_week, data.total_students)} tone="green" label={`${share(data.checked_in_this_week, data.total_students)}% of students checked in this week`} />} />
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <Breakdown title="By department" rows={data.by_department} />
        <Breakdown title="By year" rows={data.by_year.map((r) => ({ ...r, group: /^\d+$/.test(r.group) ? `Year ${r.group}` : r.group }))} />
      </div>
    </Panel>
  );
}

function Breakdown({ title, rows }: { title: string; rows: GroupShare[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = share(r.practised, r.students);
          return (
            <li key={r.group}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium">{r.group}</span>
                <span className="tabular text-muted-foreground">{r.practised} of {r.students} · {pct}%</span>
              </div>
              <Meter value={pct} tone="primary" label={`${r.group}: ${r.practised} of ${r.students} students practised this week`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TopicRow({ t }: { t: TopicStat }) {
  const label = TOPIC_LABEL[t.category] ?? t.category;
  const avg = t.avg_score;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="tabular text-[13px] text-muted-foreground">
          {avg === null ? "No tests finished yet" : <><span className="font-semibold text-foreground">{avg.toFixed(0)}%</span> average · {t.completed} finished{t.completion_rate !== null && ` · ${t.completion_rate}% completed`}</>}
        </span>
      </div>
      <Meter value={avg} tone={avg === null ? "none" : scoreTone(avg)} target={PRACTICE_BELOW} showTarget={false} label={avg === null ? `${label}: no tests finished yet` : `${label}: average score ${avg.toFixed(0)} percent`} />
      {avg !== null && (
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {LEVELS.map((level) => {
            const l = t.by_difficulty[level];
            return <span key={level} className="tabular">{LEVEL_LABEL[level]} {l?.avg_score == null ? "–" : `${l.avg_score.toFixed(0)}%`}{l && l.completed > 0 && ` (${l.completed})`}</span>;
          })}
          {t.gave_up > 0 && <span>{t.gave_up} ran out of time</span>}
        </p>
      )}
    </li>
  );
}

function SkillGaps({ data }: { data: PracticeOverview }) {
  const needs = topicsByNeed(data.topics).filter((t) => t.avg_score !== null && t.avg_score < PRACTICE_BELOW);
  return (
    <Panel
      title="Skill gaps by topic"
      description={`Average mock-test score per topic over the last ${data.topic_window_days} days, lowest first. Topics under ${PRACTICE_BELOW}% may need more teaching or practice.`}
    >
      {!hasResults(data.topics) ? (
        <Empty>No mock tests have been finished yet. Scores appear here once students start taking them.</Empty>
      ) : (
        <>
          {needs.length > 0 && (
            <p className="mb-3 rounded-lg bg-risk-amber-bg px-3 py-2 text-[13px] text-risk-amber">
              May need practice: {needs.map((t) => TOPIC_LABEL[t.category] ?? t.category).join(", ")}.
            </p>
          )}
          <ul className="divide-y divide-border">{topicsByNeed(data.topics).map((t) => <TopicRow key={t.category} t={t} />)}</ul>
        </>
      )}
    </Panel>
  );
}

/** Admin Overview section: who is practising, and which topics students find hardest. Covers all students. */
export function PracticeInsights() {
  const { data, error, loading } = useCachedQuery("admin:practice", () => api<PracticeOverview>("/practice/overview"));
  if (loading && !data) return <Skeleton className="h-56 w-full" />;
  if (error || !data) return <Panel title="Practice and skill gaps"><Empty>Practice analytics are unavailable right now. The rest of the overview is unaffected.</Empty></Panel>;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Participation data={data.participation} />
      <SkillGaps data={data} />
    </div>
  );
}
