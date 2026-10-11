"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Minus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/format";
import { StudentLoading } from "../StudentPage";
import { PracticePlan } from "./PracticePlan";
import { QuestionReview } from "./QuestionReview";
import { CRITERIA, STATUS_STYLE, type CoachFeedback, type CriterionKey, type FocusRow, type PracticeTask } from "./types";

interface Attempt { id: number; created_at: string; score: number; feedback: CoachFeedback | null }
interface Data { attempts: Attempt[]; focus: FocusRow[]; tasks: PracticeTask[]; coachingReady: boolean }
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Data };

const card = "rounded-xl border border-[#dce7e1] bg-white p-5 shadow-sm shadow-slate-900/[0.03]";
// A teal close to the app's primary, saturated enough to read as a data mark (validated: chroma, contrast). Single
// series, so no legend is needed.
const LINE = "#0d8a74";
const READY_SCORE = 4.0;
const READY_CRITERION = 3.5;

/** Missing coaching tables (before the 003 migration runs) are treated as "no data yet", not as an error. */
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

async function load(): Promise<Data> {
  const sb = createClient();
  const [att, foc] = await Promise.all([
    sb.from("mock_interviews").select("id,created_at,score,feedback").not("score", "is", null).order("created_at"),
    sb.from("interview_focus_areas").select("*").order("updated_at", { ascending: false }),
  ]);
  if (att.error) throw new Error(att.error.message);
  if (foc.error && !missingTable(foc.error.code)) throw new Error(foc.error.message);
  const attempts = (att.data ?? []).map((a) => ({ ...a, score: Number(a.score) })) as Attempt[];
  let tasks: PracticeTask[] = [];
  const latest = [...attempts].reverse().find((a) => (a.feedback?.plan?.length ?? 0) > 0);
  if (latest && !foc.error) {
    const t = await sb.from("interview_practice_tasks").select("id,day,task,done,interview_id").eq("interview_id", latest.id).order("day").order("id");
    if (!t.error) tasks = (t.data ?? []) as PracticeTask[];
  }
  return { attempts, focus: (foc.data ?? []) as FocusRow[], tasks, coachingReady: !foc.error };
}

function readiness(attempts: Attempt[]) {
  const last = attempts.slice(-3);
  const avg = last.reduce((s, a) => s + a.score, 0) / Math.max(last.length, 1);
  const withCriteria = last.filter((a) => a.feedback?.criteria);
  const critAvg = (k: CriterionKey) => withCriteria.reduce((s, a) => s + (a.feedback!.criteria![k] ?? 0), 0) / Math.max(withCriteria.length, 1);
  const weakest = CRITERIA.map((c) => ({ ...c, value: critAvg(c.key) })).sort((a, b) => a.value - b.value)[0];
  const ready = last.length >= 3 && avg >= READY_SCORE && withCriteria.length > 0 && weakest.value >= READY_CRITERION;
  return { ready, avg, count: last.length, weakest: withCriteria.length ? weakest : null };
}

function Delta({ value }: { value: number }) {
  if (Math.abs(value) < 0.05) return <span className="inline-flex items-center gap-0.5 text-slate-400"><Minus className="h-3.5 w-3.5" aria-hidden="true" />0.0</span>;
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${up ? "text-[#18574e]" : "text-red-700"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
      {up ? "+" : ""}{value.toFixed(1)}
    </span>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function View({ data }: { data: Data }) {
  const { attempts, focus, tasks } = data;
  if (attempts.length === 0) {
    return (
      <div className={`${card} text-center`}>
        <p className="font-medium text-[#172824]">No finished interviews yet</p>
        <p className="mt-1 text-sm text-slate-500">Take your first mock interview to get a score, a practice plan and progress tracking.</p>
        <Link href="/student/interview" className="mt-3 inline-block rounded-lg bg-[#18574e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12473f]">Start an interview</Link>
      </div>
    );
  }
  const r = readiness(attempts);
  const first = attempts[0], latest = attempts[attempts.length - 1];
  const best = Math.max(...attempts.map((a) => a.score));
  const firstC = attempts.find((a) => a.feedback?.criteria)?.feedback?.criteria;
  const latestC = [...attempts].reverse().find((a) => a.feedback?.criteria)?.feedback?.criteria;
  const chart = attempts.map((a, i) => ({ n: `#${i + 1}`, date: shortDate(a.created_at), score: a.score }));
  const open = focus.filter((f) => f.status !== "resolved");
  const resolved = focus.filter((f) => f.status === "resolved");

  return (
    <div className="space-y-5">
      <section className={`${card} flex flex-col gap-3 sm:flex-row sm:items-center`} aria-label="Interview readiness">
        {r.ready ? (
          <>
            <CheckCircle2 className="h-8 w-8 shrink-0 text-[#286a62]" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-[#172824]">Interview-ready</p>
              <p className="text-sm text-slate-600">Your last 3 interviews average {fmt(r.avg, 1)} / 5 with no weak criterion. Keep it up before placement drives.</p>
            </div>
          </>
        ) : (
          <div>
            <p className="text-lg font-semibold text-[#172824]">Building up</p>
            <p className="text-sm text-slate-600">
              {r.count < 3 ? `Take ${3 - r.count} more interview${3 - r.count === 1 ? "" : "s"} to get a readiness check. ` : ""}
              Interview-ready means your last 3 interviews average {READY_SCORE.toFixed(1)}+ with every criterion at {READY_CRITERION}+.
              {r.weakest && r.count >= 1 && ` Right now your weakest criterion is ${r.weakest.label.toLowerCase()} (${fmt(r.weakest.value, 1)}).`}
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Interviews", String(attempts.length)], ["Latest score", `${fmt(latest.score, 1)} / 5`], ["Best score", `${fmt(best, 1)} / 5`]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#dce7e1] bg-white p-4"><p className="text-xs text-slate-500">{k}</p><p className="mt-1 text-xl font-semibold tabular-nums text-[#172824]">{v}</p></div>
        ))}
        <div className="rounded-xl border border-[#dce7e1] bg-white p-4"><p className="text-xs text-slate-500">Since your first</p><p className="mt-1 text-xl tabular-nums"><Delta value={latest.score - first.score} /></p></div>
      </div>

      {attempts.length >= 2 && (
        <section className={card} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="text-base font-semibold text-[#172824]">Interview score over time</h2>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
                <CartesianGrid stroke="#e8efeb" vertical={false} />
                <XAxis dataKey="n" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)} / 5`, "Score"]} labelFormatter={(n, p) => `${n} · ${p?.[0]?.payload?.date ?? ""}`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke={LINE} strokeWidth={2} dot={{ r: 4, fill: LINE }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-slate-500">Show as a table</summary>
            <table className="mt-2 w-full text-left text-xs tabular-nums">
              <thead className="text-slate-500"><tr><th className="py-1">Interview</th><th>Date</th><th>Score</th></tr></thead>
              <tbody>{chart.map((c) => <tr key={c.n} className="border-t"><td className="py-1">{c.n}</td><td>{c.date}</td><td>{c.score.toFixed(1)}</td></tr>)}</tbody>
            </table>
          </details>
        </section>
      )}

      {firstC && latestC && (
        <section className={card} aria-labelledby="criteria-heading">
          <h2 id="criteria-heading" className="text-base font-semibold text-[#172824]">By criterion: first interview vs latest</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1 font-medium">Criterion</th><th className="text-right font-medium">First</th><th className="text-right font-medium">Latest</th><th className="text-right font-medium">Change</th></tr></thead>
            <tbody>
              {CRITERIA.map((c) => (
                <tr key={c.key} className="border-t border-[#eef3f0]">
                  <td className="py-2">{c.label}</td>
                  <td className="text-right tabular-nums text-slate-600">{fmt(firstC[c.key], 1)}</td>
                  <td className="text-right tabular-nums font-medium">{fmt(latestC[c.key], 1)}</td>
                  <td className="text-right tabular-nums"><Delta value={latestC[c.key] - firstC[c.key]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card} aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="text-base font-semibold text-[#172824]">Your focus areas</h2>
          {!data.coachingReady ? <p className="mt-2 text-sm text-slate-500">Focus tracking will appear here once it&apos;s switched on.</p>
            : focus.length === 0 ? <p className="mt-2 text-sm text-slate-500">Focus areas appear after your next interview.</p> : (
              <ul className="mt-3 space-y-2">
                {[...open, ...resolved].map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#f7faf8] px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-[#172824]">{f.label}</p>
                      <p className="text-xs text-slate-500">Came up in {f.times_seen} interview{f.times_seen === 1 ? "" : "s"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[f.status].chip}`}>{STATUS_STYLE[f.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          {open.length > 0 && (
            <Link href="/student/interview" className="mt-3 inline-block text-sm font-semibold text-[#286a62] underline underline-offset-2">Practise these in a focused interview</Link>
          )}
        </section>

        <section className={card} aria-labelledby="latest-plan-heading">
          <h2 id="latest-plan-heading" className="text-base font-semibold text-[#172824]">Latest practice plan</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">From your most recent interview with a plan.</p>
          <PracticePlan tasks={tasks} />
        </section>
      </div>

      <section className={card} aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-base font-semibold text-[#172824]">All interviews</h2>
        <ol className="mt-3 space-y-2">
          {[...attempts].reverse().map((a, i) => (
            <li key={a.id}>
              <details className="rounded-lg border border-[#e2ebe6] bg-white">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286a62]">
                  <span className="font-medium text-[#172824]">
                    #{attempts.length - i} · {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {a.feedback?.mode === "focus" && <span className="ml-2 rounded-full bg-[#f1f6f3] px-2 py-0.5 text-[11px] font-medium text-[#18574e]">Focused practice</span>}
                  </span>
                  <span className="text-slate-600">
                    <span className="font-semibold tabular-nums text-[#172824]">{fmt(a.score, 1)} / 5</span>
                    {a.feedback?.minutes !== undefined && <span className="ml-2 text-xs">{fmt(a.feedback.minutes, 0)} min · {a.feedback.questions ?? "—"} questions</span>}
                  </span>
                </summary>
                <div className="space-y-3 border-t border-[#eef3f0] p-3">
                  {a.feedback?.criteria && (
                    <p className="text-xs text-slate-600">{CRITERIA.map((c) => `${c.label} ${fmt(a.feedback!.criteria![c.key], 1)}`).join(" · ")}</p>
                  )}
                  <QuestionReview items={a.feedback?.per_question ?? []} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function InterviewProgress() {
  const [state, setState] = useState<State>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    load().then((data) => !cancelled && setState({ status: "ready", data })).catch(() => !cancelled && setState({ status: "error" }));
    return () => { cancelled = true; };
  }, []);
  if (state.status === "loading") return <StudentLoading rows={4} />;
  if (state.status === "error") {
    return <div role="alert" className={`${card} text-sm text-slate-600`}>We couldn&apos;t load your interview history right now. Check your connection and refresh the page.</div>;
  }
  return <View data={state.data} />;
}
