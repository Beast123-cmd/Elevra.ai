"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Flame, LoaderCircle, RefreshCw, Sparkles, Target, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StudentReveal } from "./StudentReveal";
import { showCoinReward } from "./CoinRewardCelebration";

type Category = "aptitude" | "coding" | "mcq";
type Difficulty = "easy" | "medium" | "hard";
interface Attempt { category: Category; difficulty: Difficulty; correct: boolean; coins: number }
interface DailyState { activity_date: string; login: { streak_days: number; coins: number } | null; attempts: Attempt[]; coin_balance: number }
interface Question { question_id: string; category: Category; difficulty: Difficulty; prompt: string; input_type: "choice" | "text"; options: { id: string; label: string }[]; coins_available: number; result?: { answer: string; correct: boolean; coins: number; correct_answer: string; explanation: string } }
interface AnswerResult { correct: boolean; coins: number; already_completed: boolean; correct_answer: string; explanation: string }
type PageState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; daily: DailyState };

const DIFFICULTIES: { id: Difficulty; label: string; coins: number }[] = [
  { id: "easy", label: "Easy", coins: 10 }, { id: "medium", label: "Medium", coins: 20 }, { id: "hard", label: "Hard", coins: 30 },
];

export function DailyChallenges() {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<Category>("aptitude");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionError, setQuestionError] = useState("");
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => { setState({ status: "loading" }); setReload((value) => value + 1); }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const reward = await api<{ awarded: boolean; coins: number }>("/daily-challenges/check-in", {});
        if (reward.awarded) showCoinReward(reward.coins);
        const daily = await api<DailyState>("/daily-challenges");
        if (active) setState({ status: "ready", daily });
      } catch (error) {
        if (active) setState({ status: "error", message: error instanceof Error ? error.message : "Could not load today's challenges." });
      }
    }
    void load();
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    let active = true;
    setQuestion(null); setResult(null); setSelected(""); setQuestionError("");
    if (state.status !== "ready") return () => { active = false; };
    const query = new URLSearchParams({ category, difficulty });
    api<Question>(`/daily-challenges/question?${query.toString()}`).then((value) => {
      if (!active) return;
      setQuestion(value);
      if (value.result) setResult({ correct: value.result.correct, coins: value.result.coins, already_completed: true, correct_answer: value.result.correct_answer, explanation: value.result.explanation });
    }).catch((error: Error) => { if (active) setQuestionError(error.message); });
    return () => { active = false; };
  }, [state.status, category, difficulty, reload]);

  async function submitAnswer() {
    if (!question || !selected || submitting || result) return;
    setSubmitting(true);
    try {
      const answerResult = await api<AnswerResult>("/daily-challenges/answer", {
        category, difficulty, question_id: question.question_id, answer: selected,
      });
      if (answerResult.coins > 0) showCoinReward(answerResult.coins);
      setResult(answerResult);
      const daily = await api<DailyState>("/daily-challenges");
      setState({ status: "ready", daily });
    } catch (error) {
      setQuestionError(error instanceof Error ? error.message : "Could not submit your answer.");
    } finally { setSubmitting(false); }
  }

  return <main className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-9 lg:px-10">
    <StudentReveal><header className="mb-6 border-l-2 border-primary pl-4"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Build your streak</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Daily challenges</h1><p className="mt-1 text-sm text-muted-foreground">A quick aptitude or coding question each day. Choose your difficulty and earn coins for correct answers.</p></header></StudentReveal>

    {state.status === "loading" && <Card className="rounded-xl border-border"><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your daily challenges…</CardContent></Card>}
    {state.status === "error" && <Card role="alert" className="rounded-xl border-border"><CardContent className="p-5"><h2 className="font-semibold text-foreground">Daily challenges are unavailable</h2><p className="mt-1 text-sm text-muted-foreground">{state.message}</p><button onClick={refresh} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></CardContent></Card>}

    {state.status === "ready" && <>
      <StudentReveal className="grid gap-3 sm:grid-cols-3" delayMs={70}>
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Flame className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Daily login reward</p><p className="font-semibold text-foreground">+{state.daily.login?.coins ?? 5} coins · {state.daily.login?.streak_days ?? 1} day streak</p></div></CardContent></Card>
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Target className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Today's challenges</p><p className="font-semibold text-foreground">{state.daily.attempts.length} / 9 completed</p></div></CardContent></Card>
        <Card className="rounded-xl border-border bg-card"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Trophy className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-xs text-muted-foreground">Your coin wallet</p><p className="font-semibold text-foreground">{state.daily.coin_balance} coins · {(state.daily.login?.coins ?? 0) + state.daily.attempts.reduce((sum, item) => sum + item.coins, 0)} earned today</p></div></CardContent></Card>
      </StudentReveal>
      {state.daily.login?.streak_days && state.daily.login.streak_days % 7 === 0 && <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary"><Sparkles className="mr-2 inline h-4 w-4" aria-hidden="true" />Seven day streak! You earned a 25 point bonus.</p>}

      <StudentReveal delayMs={140}><Card className="mt-5 rounded-xl border-border bg-card shadow-sm"><CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Pick a challenge</h2><p className="mt-1 text-sm text-muted-foreground">One attempt per topic and difficulty each day.</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Resets at midnight · India time</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Topic</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Challenge topic">
              {(["aptitude", "coding", "mcq"] as const).map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 rounded-lg border px-2 text-sm font-medium capitalize transition-colors ${category === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{item === "mcq" ? "MCQ" : item === "coding" ? "Coding" : "Aptitude"}</button>)}
            </div>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Difficulty and coins</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Challenge difficulty">
              {DIFFICULTIES.map((item) => {
                const completed = state.daily.attempts.some((attempt) => attempt.category === category && attempt.difficulty === item.id);
                return <button key={item.id} type="button" onClick={() => setDifficulty(item.id)} aria-pressed={difficulty === item.id} className={`min-h-10 rounded-lg border px-3 text-left transition-colors ${difficulty === item.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}><span className="block text-sm font-semibold">{item.label}</span><span className="block text-[11px]">{item.coins} coins{completed ? " · done" : ""}</span></button>;
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Login daily for 5 coins. Every 7 consecutive days adds a 25 coin streak bonus.</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{category} · {difficulty}</p><p className="mt-1 text-xs text-muted-foreground">Earn {question?.coins_available ?? DIFFICULTIES.find((item) => item.id === difficulty)?.coins} coins for a correct answer.</p></div><CircleHelp className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
            {questionError && <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"><span>{questionError}</span><button type="button" onClick={refresh} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-foreground"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Retry</button></div>}
            {!question && !questionError && <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading question…</div>}
            {question && <>
              <h3 className="mt-4 text-base font-medium leading-6 text-foreground">{question.prompt}</h3>
              <fieldset disabled={!!result || submitting} className="mt-4 space-y-2"><legend className="sr-only">{question.input_type === "choice" ? "Choose your answer" : "Enter your answer"}</legend>
                {question.input_type === "choice" ? question.options.map((option) => <label key={option.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${selected === option.id ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-input"}`}><input type="radio" name="challenge-answer" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} className="accent-primary" /><span className="font-semibold">{option.id}.</span><span>{option.label}</span></label>) : <input type="text" value={selected} onChange={(event) => setSelected(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Type your answer" className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20" />}
              </fieldset>
              {result && <div role="status" className={`mt-4 rounded-lg border p-3 text-sm ${result.correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}><p className="font-semibold text-foreground">{result.correct ? `Correct! +${result.coins} coins` : `Not quite · ${result.coins} coins`}</p><p className="mt-1 leading-5 text-muted-foreground">{result.explanation}</p></div>}
              <button type="button" onClick={submitAnswer} disabled={!selected || !!result || submitting} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Checking…</> : result ? <><Check className="h-4 w-4" aria-hidden="true" />Completed today</> : <>Submit answer <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}</button>
            </>}
          </div>
        </div>
      </CardContent></Card></StudentReveal>
      <StudentReveal delayMs={210}><div className="mt-5 text-center"><Link href="/student/achievements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary no-underline hover:underline">See your badges and titles <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></div></StudentReveal>
    </>}
  </main>;
}
