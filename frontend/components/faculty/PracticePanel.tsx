"use client";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Meter } from "@/components/shared/viz";
import { Empty, Panel, Stat } from "@/components/shared/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  lastActiveText, LEVEL_LABEL, quietForAWeek, scoreTone, TOPIC_LABEL, TREND_TEXT, type StudentPractice,
} from "@/components/shared/practiceUi";

const when = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** A mentee's practice habit: login streak, active days and how their recent mock-test scores are moving. */
export function PracticePanel({ studentId }: { studentId: string }) {
  const { data, error, loading } = useCachedQuery(`practice:${studentId}`, () => api<StudentPractice>(`/practice/student/${encodeURIComponent(studentId)}`));

  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (error || !data) {
    return <Panel title="Practice and streak"><Empty>Practice data is unavailable right now. The rest of this page is unaffected.</Empty></Panel>;
  }

  const quiet = quietForAWeek(data.last_active);
  return (
    <Panel
      title="Practice and streak"
      description="Daily challenges, mock tests and check-ins. A signal for a conversation, not a mark."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Check-in streak" value={`${data.current_streak} ${data.current_streak === 1 ? "day" : "days"}`} note={`Best: ${data.best_streak}`} />
        <Stat label="Active days, last 30" value={`${data.active_days_30} of 30`} />
        <Stat label="Last practised" value={<span className="text-[20px]">{lastActiveText(data.last_active)}</span>} note={`${data.tests_completed} mock ${data.tests_completed === 1 ? "test" : "tests"} finished`} />
      </div>

      {quiet && (
        <p className="mt-3 rounded-lg bg-risk-amber-bg px-3 py-2 text-[13px] text-risk-amber">
          {data.last_active === null ? "This student hasn't tried the practice features yet." : "Nothing practised in the last 7 days."} A short check-in may help.
        </p>
      )}

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Recent mock tests</h3>
          {data.trend && <span className="text-[13px] font-medium text-foreground">{TREND_TEXT[data.trend]}</span>}
        </div>
        {data.recent_tests.length === 0 ? (
          <Empty>No mock tests finished yet.</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {data.recent_tests.map((t, i) => (
              <li key={`${t.date}-${t.category}-${i}`} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 py-2 text-[13px] sm:grid-cols-[5rem_10rem_1fr_3rem]">
                <span className="tabular text-muted-foreground">{when(t.date)}</span>
                <span className="min-w-0 truncate">{TOPIC_LABEL[t.category] ?? t.category} · {LEVEL_LABEL[t.difficulty] ?? t.difficulty}</span>
                <span className="hidden sm:block"><Meter value={t.score_percent} tone={scoreTone(t.score_percent)} height={6} showTarget={false} label={`${t.score_percent} percent`} /></span>
                <span className="tabular text-right font-semibold">{t.score_percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
