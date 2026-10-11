import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import { PracticePlan } from "./PracticePlan";
import { QuestionReview } from "./QuestionReview";
import { CRITERIA, REVISIT_LABEL, type CoachFeedback, type PracticeTask } from "./types";

const card = "rounded-xl border border-[#dce7e1] bg-white p-5 shadow-sm shadow-slate-900/[0.03]";

/** The coaching part of the interview result: focus areas, progress on revisited areas, the plan and a per-question review. */
export function CoachReport({ feedback, tasks }: { feedback: CoachFeedback; tasks: PracticeTask[] }) {
  const focus = feedback.focus_areas ?? [];
  const revisited = feedback.revisited ?? [];
  const categoryLabel = (key: string) => CRITERIA.find((c) => c.key === key)?.label ?? key;
  if (!feedback.per_question?.length && focus.length === 0) return null; // older or offline-marked interviews

  return (
    <div className="space-y-4">
      {revisited.length > 0 && (
        <section className={card} aria-labelledby="revisit-heading">
          <h3 id="revisit-heading" className="text-base font-semibold text-[#172824]">Your weak areas, retested</h3>
          <ul className="mt-3 space-y-2">
            {revisited.map((r) => (
              <li key={r.topic} className="flex items-center justify-between gap-3 text-sm">
                <span>{r.label ?? r.topic.replace(/-/g, " ")}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${r.result === "gap" ? "bg-amber-50 text-amber-900 ring-amber-100" : r.result === "improved" ? "bg-blue-50 text-blue-800 ring-blue-100" : "bg-[#eaf3ef] text-[#18574e] ring-[#d3e7dd]"}`}>
                  {REVISIT_LABEL[r.result]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="focus-heading">
          <h3 id="focus-heading" className="flex items-center gap-2 text-base font-semibold text-[#172824]"><Target className="h-4 w-4 text-[#286a62]" aria-hidden="true" />Focus on next</h3>
          {focus.length === 0 ? <p className="mt-2 text-sm text-slate-500">No specific focus areas this time.</p> : (
            <ul className="mt-3 space-y-2">
              {focus.map((f) => (
                <li key={f.topic} className="rounded-lg bg-[#f7faf8] px-3 py-2">
                  <p className="text-sm font-medium text-[#172824]">{f.label}</p>
                  <p className="text-xs text-slate-500">{categoryLabel(f.category)}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Next time, choose &ldquo;Practise my weak areas&rdquo; and Elevra will test these again.</p>
        </section>

        <section className={card} aria-labelledby="plan-heading">
          <h3 id="plan-heading" className="text-base font-semibold text-[#172824]">Your 7-day practice plan</h3>
          <p className="mb-3 mt-1 text-xs text-slate-500">15–30 minutes a day. Tick tasks off as you go; your mentor can see your progress.</p>
          <PracticePlan tasks={tasks} />
        </section>
      </div>

      {feedback.per_question && feedback.per_question.length > 0 && (
        <section className={card} aria-labelledby="questions-heading">
          <h3 id="questions-heading" className="text-base font-semibold text-[#172824]">Question by question</h3>
          <p className="mb-3 mt-1 text-xs text-slate-500">Open a question to see what was missing and what a stronger answer includes.</p>
          <QuestionReview items={feedback.per_question} />
        </section>
      )}

      <Link href="/student/interview/progress"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#286a62] underline underline-offset-2">
        See all my interviews and progress <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
