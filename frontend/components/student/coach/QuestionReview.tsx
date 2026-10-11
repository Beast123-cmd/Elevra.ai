import { fmt } from "@/lib/format";
import type { QuestionReview as Review } from "./types";

/** Per-question breakdown: what was said, the rating, and what a stronger answer would include. */
export function QuestionReview({ items }: { items: Review[] }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">No per-question review for this interview.</p>;
  return (
    <ol className="space-y-2">
      {items.map((q, i) => (
        <li key={i}>
          <details className="group rounded-lg border border-[#e2ebe6] bg-white">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
              <span className="font-medium text-[#172824]"><span className="mr-1.5 text-slate-400">Q{i + 1}.</span>{q.question}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${q.rating >= 4 ? "bg-[#eaf3ef] text-[#18574e] ring-[#d3e7dd]" : q.rating >= 3 ? "bg-blue-50 text-blue-800 ring-blue-100" : "bg-amber-50 text-amber-900 ring-amber-100"}`}>
                {fmt(q.rating, 1)} / 5
              </span>
            </summary>
            <div className="space-y-2 border-t border-[#eef3f0] px-3 pb-3 pt-2 text-sm">
              <p><span className="text-slate-500">You said: </span>{q.answer_summary}</p>
              {q.good && <p><span className="font-medium text-[#18574e]">Good: </span>{q.good}</p>}
              {q.missing && <p><span className="font-medium text-amber-800">Missing: </span>{q.missing}</p>}
              {q.stronger.length > 0 && (
                <div>
                  <p className="font-medium text-slate-700">A stronger answer would include:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-slate-600">{q.stronger.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
